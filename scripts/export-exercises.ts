import { getAdminDb } from '../src/lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to export all exercises from Firestore to a JSON file
 * 
 * Run with: npx tsx scripts/export-exercises.ts
 */
async function exportExercises() {
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
    
    const output = {
      exportedAt: new Date().toISOString(),
      count: exercises.length,
      exercises: exercises,
    };
    
    // Write to JSON file
    const outputPath = path.join(process.cwd(), 'exercises-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`✅ Successfully exported ${exercises.length} exercises to ${outputPath}`);
    
    return output;
  } catch (error) {
    console.error('❌ Error exporting exercises:', error);
    process.exit(1);
  }
}

exportExercises();

