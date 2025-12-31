import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn('Could not load .env.local, using process.env');
  }
}

loadEnv();

// Initialize Firebase Admin
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase Admin environment variables. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.local');
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = getFirestore();

async function migrateAllUsers() {
  console.log('Starting migration...\n');

  try {
    // Get all unique user IDs from workout_routines
    const routinesSnapshot = await db.collection('workout_routines').get();
    const userIds = new Set<string>();
    
    routinesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });

    console.log(`Found ${userIds.size} unique users\n`);

    let totalProcessed = 0;
    let totalErrors = 0;

    // Migrate each user
    for (const userId of userIds) {
      console.log(`Processing user: ${userId}`);
      
      const batch = db.batch();
      let processedCount = 0;

      // Get or create "My Program" for the user
      const programsQuery = db.collection('workout_programs')
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
        myProgramRef = db.collection('workout_programs').doc(myProgramId);
        console.log(`  Using existing "My Program": ${myProgramId}`);
      } else {
        // Create "My Program"
        myProgramRef = db.collection('workout_programs').doc();
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
        console.log(`  Creating "My Program": ${myProgramId}`);
      }

      // Get all routines for this user that don't have a programId
      const routinesQuery = db.collection('workout_routines')
        .where('userId', '==', userId);

      const userRoutinesSnapshot = await routinesQuery.get();
      const routineIds: string[] = [];

      // Update all routines to belong to "My Program"
      userRoutinesSnapshot.forEach((doc) => {
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

      // Update program with routine IDs
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
        console.log(`  ✓ Migrated ${processedCount} routines`);
        totalProcessed += processedCount;
      } catch (batchError) {
        console.error(`  ✗ Error migrating user ${userId}:`, batchError);
        totalErrors++;
      }
      console.log('');
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total routines processed: ${totalProcessed}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log('Migration completed!');

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run the migration
migrateAllUsers()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

