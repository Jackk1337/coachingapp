import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api-auth';

/**
 * Migration API route to create workout programs and migrate existing routines
 * This should be run once to migrate all existing workout routines to the new program structure
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const userId = await verifyAuth(request);
    
    const adminDb = getAdminDb();
    const batch = adminDb.batch();
    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Get or create "My Program" for the user
    const programsQuery = adminDb.collection('workout_programs')
      .where('userId', '==', userId)
      .where('name', '==', 'My Program')
      .limit(1);

    const existingPrograms = await programsQuery.get();
    let myProgramId: string;
    let programNeedsCreation = false;
    let myProgramRef: FirebaseFirestore.DocumentReference;

    if (!existingPrograms.empty) {
      // Use existing "My Program"
      myProgramId = existingPrograms.docs[0].id;
      myProgramRef = adminDb.collection('workout_programs').doc(myProgramId);
    } else {
      // Create "My Program"
      myProgramRef = adminDb.collection('workout_programs').doc();
      batch.set(myProgramRef, {
        name: 'My Program',
        description: 'Default program for your workout routines',
        userId: userId,
        routineIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      myProgramId = myProgramRef.id;
      programNeedsCreation = true;
    }

    // Get all routines for this user that don't have a programId
    const routinesQuery = adminDb.collection('workout_routines')
      .where('userId', '==', userId);

    const routinesSnapshot = await routinesQuery.get();
    const routineIds: string[] = [];

    // Update all routines to belong to "My Program"
    routinesSnapshot.forEach((doc) => {
      const routineData = doc.data();
      
      // Only migrate routines that don't already have a programId
      if (!routineData.programId) {
        routineIds.push(doc.id);
        batch.update(doc.ref, {
          programId: myProgramId,
        });
        processedCount++;
      }
    });

    // Update program with routine IDs (preserve existing ones if any)
    if (!programNeedsCreation) {
      // Only fetch if program wasn't just created
      const myProgramDoc = await myProgramRef.get();
      if (myProgramDoc.exists) {
        const existingRoutineIds = myProgramDoc.data()?.routineIds || [];
        const combinedRoutineIds = [...new Set([...existingRoutineIds, ...routineIds])];
        batch.update(myProgramRef, {
          routineIds: combinedRoutineIds,
          updatedAt: new Date(),
        });
      }
    } else {
      // Update the program we just created
      batch.update(myProgramRef, {
        routineIds: routineIds,
        updatedAt: new Date(),
      });
    }

    // Commit the batch
    try {
      await batch.commit();
    } catch (batchError) {
      errorCount++;
      errors.push(`Batch commit failed: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      processed: processedCount,
      errors: errorCount,
      errorDetails: errors,
      programId: myProgramId,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check migration status
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    const adminDb = getAdminDb();

    // Check if user has "My Program"
    const programsQuery = adminDb.collection('workout_programs')
      .where('userId', '==', userId)
      .where('name', '==', 'My Program')
      .limit(1);

    const existingPrograms = await programsQuery.get();
    const hasMyProgram = !existingPrograms.empty;

    // Count routines without programId
    const routinesQuery = adminDb.collection('workout_routines')
      .where('userId', '==', userId);

    const routinesSnapshot = await routinesQuery.get();
    const routinesWithoutProgram = routinesSnapshot.docs.filter(
      (doc) => !doc.data().programId
    ).length;

    return NextResponse.json({
      hasMyProgram,
      routinesWithoutProgram,
      totalRoutines: routinesSnapshot.size,
      needsMigration: routinesWithoutProgram > 0 || !hasMyProgram,
    });
  } catch (error) {
    console.error('Migration status check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
