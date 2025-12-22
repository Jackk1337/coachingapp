import { NextRequest, NextResponse } from 'next/server';
import { collectWeeklyData } from '@/lib/weeklyDataCollector';
import { generateCoachingMessage } from '@/lib/genkitFlows';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, weekStartDate } = body;

    if (!userId || !weekStartDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and weekStartDate' },
        { status: 400 }
      );
    }

    // Collect all weekly data
    const weeklyData = await collectWeeklyData(userId, weekStartDate);

    // Check if weekly checkin exists
    if (!weeklyData.weeklyCheckin) {
      return NextResponse.json(
        { error: 'Weekly checkin not found for the specified week' },
        { status: 404 }
      );
    }

    // Use coachId from profile, or default to 'AI Coach'
    const coachId = weeklyData.userProfile?.coachId || 'AI Coach';
    
    // Fetch coach name and persona from coaches collection BEFORE generating message
    let coachName = 'AI Coach';
    let coachPersona = '';
    if (coachId && coachId !== 'AI Coach') {
      try {
        const coachRef = doc(db, 'coaches', coachId);
        const coachSnap = await getDoc(coachRef);
        if (coachSnap.exists()) {
          const coachData = coachSnap.data();
          coachName = coachData.coach_name || coachId;
          coachPersona = coachData.coach_persona || '';
        }
      } catch (error) {
        console.error('Error fetching coach data:', error);
        // Fallback to coachId if fetch fails
        coachName = coachId;
      }
    }

    // Generate coaching message using AI (pass coachName and coachPersona)
    let subject: string;
    let messageBody: string;
    
    try {
      const result = await generateCoachingMessage(weeklyData, coachName, coachPersona);
      subject = result.subject;
      messageBody = result.body;
    } catch (error: unknown) {
      // Check if it's a rate limit error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') ||
                         errorMessage.toLowerCase().includes('too many requests') ||
                         errorStatus === 429;
      
      if (isRateLimit) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: 'The AI service is currently experiencing high demand. Please try again in a few minutes.',
            retryAfter: 60, // seconds
          },
          { status: 429 }
        );
      }
      
      // Re-throw other errors
      throw error;
    }

    // Save message to Firestore
    const messageRef = await addDoc(collection(db, 'messages'), {
      userId,
      subject,
      body: messageBody,
      coach_id: coachId,
      coach_name: coachName,
      read: false,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      messageId: messageRef.id,
      subject,
    });
  } catch (error) {
    console.error('Error generating coaching message:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate coaching message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
