import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Export endpoint to get all exercises from exercise_library as JSON
 * 
 * Usage: GET /api/export-exercises
 */
export async function GET() {
  try {
    const db = getAdminDb();
    const exercisesRef = db.collection('exercise_library');
    
    // Get all exercises, ordered by name
    const snapshot = await exercisesRef.orderBy('name').get();
    
    const exercises: any[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      exercises.push({
        id: doc.id,
        name: data.name,
        category: data.category,
        userId: data.userId,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      });
    });
    
    return NextResponse.json({
      success: true,
      count: exercises.length,
      exercises: exercises,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error exporting exercises:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

