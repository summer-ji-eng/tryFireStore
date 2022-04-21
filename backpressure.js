const {FirestoreClient} = require('@google-cloud/firestore').v1;

async function main() {
  // Create a new client
  const firestore = new FirestoreClient({fallback: 'rest'});
  const projectId = await firestore.getProjectId();
  // const collectionIds = ['node_5.0.2_HGzGRdbp1FaS9h0fIO0v', 'node_5.0.2_fSpfda10fiqrZU7IyHIp', 'node_5.0.2_1rwMHvpdRk0VBaCKMHQM']
  const collectionIds = ['node_5.0.2_HGzGRdbp1FaS9h0fIO0v']
  let stream;
  for (const collectionId of collectionIds) {
    const request = {
      parent: `projects/${projectId}/databases/(default)/documents`,
      structuredQuery: {
        endAt: {
          before: true,
          values: [{
            referenceValue: `projects/${projectId}/databases/(default)/documents/${collectionId}/Im743A6tFMMDtIJBWa2y`,
            valueType: 'referenceValue'
          }]
        },
        from: [{
          allDescendants: true,
          collectionId: `${collectionId}`,
        }],
        orderBy: [{
          direction: 'ASCENDING',
          field: {
            fieldPath: '__name__'
          }
        }],
      }
    }
    stream = firestore.runQuery(request);
    // console.log('----stream:: ', stream)
  }
  let counter = 0;
  stream.on('error', (err) => {
    console.log('----error:: ', err);
  })
  stream.on('data', data => {
    counter++;
    console.log('How many data records:: ', counter)
    // console.log('----received da÷ta:: ', JSON.stringify(data, null, 2));
  })
  stream.on('end', () => {
    console.log('How many data records:: ', counter)
    console.log('----stream end');
  })
  stream.on('close', () => {
    console.log('----stream close');
  })
  stream.on('response', (resp) => {
    console.log('response event received::', resp)
  })
  stream.on('status', (resp) => {
    console.log('response event status::', resp)
  })
}

main();

