const {Firestore} = require('@google-cloud/firestore');
const {FirestoreClient} = require('@google-cloud/firestore/build/src/v1/firestore_client')
const events = require('events');
const { fallback } = require('google-gax');
// // Create a new client
// // const firestore = new Firestore({fallback: 'rest'});
// const client = new FirestoreClient()
// // const projectId = await client.getProjectId();
// const db = new Firestore();
// const collectionName = 'testCollection';


// async function buildLib() {
//   for (let i = 0; i < 10; i++) {
//     const name = `doc_${i}`;
//     const docRef = db.collection(collectionName).doc(name);
//     await docRef.set({
//       title: name,
//       content: Math.random(),
//     })
//   }
// }

// async function printDocs() {
// const docRef = db.collection(collectionName);
// const snapshot = await docRef.where('title', '==', 'doc_0').get();
// if (snapshot.length == 0) {
//   console.log('No matching documents.');
//   return;
// }
// snapshot.forEach(doc => {
//   console.log(doc.id, '=>', doc.data());
// })
//   // const snapshot = await db.collection(collectionName).get();
//   // snapshot.forEach((doc) => {
//   //   console.log(doc.id, '=>', doc.data());
//   // });
// }
// printDocs();

async function runQuery() {
  const restClient = new FirestoreClient({fallback: 'rest'});
  const projectId = await restClient.getProjectId();
  const parent = `projects/${projectId}/databases/(default)/documents`;
  const structuredQuery = {
    from: [{
      collectionId: 'testCollection'
    }],
  }
  const stream = restClient.runQuery({
      parent,
      structuredQuery,
    }
  );

  stream.on('data', (data) => {
    console.log('-----data::', data);
  });
  stream.on('end', () => {
    console.log('----------------done');
  });
}

runQuery();
