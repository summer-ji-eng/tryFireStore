const stream = require('stream');
const fs = require('fs');
const { pipeline } = require('stream');

class StreamArrayParser extends stream.Transform {
  constructor(options) {
      super(Object.assign({}, options, { readableObjectMode: true, highWaterMark: 100 }));
      this._done = false;
      this._prevBlock = Buffer.from('');
      this._isInString = false;
      this._isSkipped = false;
      this._level = 0;

      // handle backpressure
      this._backpressure = 0;
      this._transforming = false;
      this._tmpCurIndex = -1;
      this._tmpObjectStart = -1;
      this._tmpChunk = null;
      this._tmpCallback = null;
  }
  _transform(chunk, _, callback) {
      let curIndex = 0;
      if (this._level === 0 && curIndex === 0) {
          console.log('---String.fromCharCode(chunk[0]):: ', String.fromCharCode(chunk[0]))
          if (String.fromCharCode(chunk[0]) !== '[') {
              this.emit('error', new Error(`Internal Error: API service stream data must start with a '[' and close with the corresponding ']', but it start with ${String.fromCharCode(chunk[0])}`));
          }
          curIndex++;
          this._level++;
      }
      this._processChunk(chunk, 0, curIndex, (objectStart, curIndex) => {
          if (this._level > 1) {
              this._prevBlock = Buffer.concat([
                  this._prevBlock,
                  chunk.slice(objectStart, curIndex),
              ]);
          }
      });
      callback();
  }
  _processChunk(chunk, objectStart, curIndex, callback) {
    if (curIndex > 4859) {
      console.log('------curIndex----------', curIndex)
    }
      if (curIndex === chunk.length) {
          return callback(objectStart, curIndex);
      }
      this._transforming = true;
      const curValue = String.fromCharCode(chunk[curIndex]);
      if (!this._isSkipped) {
          switch (curValue) {
              case '{':
                  // Check if it's in string, we ignore the curly brace in string.
                  // Otherwise the object level++.
                  if (!this._isInString) {
                      this._level++;
                  }
                  if (!this._isInString && this._level === 2) {
                      objectStart = curIndex;
                  }
                  break;
              case '"':
                  // Flip the string status
                  this._isInString = !this._isInString;
                  break;
              case '}':
                  // check if it's in string
                  // if true, do nothing
                  // if false and level = 0, push data
                  if (!this._isInString) {
                      this._level--;
                  }
                  if (!this._isInString && this._level === 1) {
                      // find a object
                      const objBuff = Buffer.concat([
                          this._prevBlock,
                          chunk.slice(objectStart, curIndex + 1),
                      ]);
                      const decodedString = new TextDecoder().decode(objBuff);
                      const json = JSON.parse(decodedString);
                      try {
                          // HTTP reponse.ok is true.
                          // const msgObj = fallbackRest_1.decodeResponse(this.rpc, true, objBuff);
                          // this.push(msgObj);
                          // console.log("hahahah, drain is not here");
                          // console.log(curIndex);
                          if (this._tmpCurIndex !== -1) {
                              console.log("-----------inside complete function---------");
                              console.log(curIndex);
                              console.log(msgObj);
                          }
                          if (this.push(json) === false) {
                              if (this._backpressure > -1) {
                                  this._tmpCurIndex = curIndex + 1;
                                  this._tmpObjectStart = objectStart;
                                  this._tmpCallback = callback;
                                  this._tmpChunk = chunk;
                                  this._transforming = false;
                                  console.log("============inside backpressure algorithm===================");
                                  console.log(this._printDebugStats());
                                  console.log("===============================================");
                                  return;
                              }
                              this._backpressure++;
                              // this._processChunk(
                              //     chunk, objectStart, curIndex + 1, callback);
                              // return this.once('drain', () => {
                              //     console.log("hahahah, drain is here");
                              //     this._processChunk(chunk, objectStart, curIndex + 1, callback);
                              // });
                          }
                      }
                      catch (err) {
                          this.emit('error', err);
                      }
                      objectStart = curIndex + 1;
                      this._prevBlock = Buffer.from('');
                  }
                  break;
              case ']':
                  if (!this._isInString && this._level === 1) {
                      // this.push(null);
                      console.log("++++-------------------------------------------------++++");
                      if (this.push(null) === false) {
                          this._done = true;
                          console.log("-------------------------------------------------");

                          this._tmpCurIndex = curIndex + 1;
                          this._tmpObjectStart = objectStart;
                          this._tmpCallback = callback;
                          this._tmpChunk = chunk;
                          this._transforming = false;
                          return;
                          // return this.once('drain', () => {
                          //     this._processChunk(chunk, objectStart, curIndex + 1, callback);
                          // });
                      }
                  }
                  break;
              case '\\':
                  // Escaping escape character.
                  this._isSkipped = true;
                  break;
              default:
                  break;
          }
      }
      else {
          this._isSkipped = false;
      }
      // if (this._tmpCurIndex !== -1) {
      //     console.log("-----------before next recursion---------");
      //     console.log(curIndex);
      //     // this._printDebugStats();
      // }
      // console.log("before entering next one");
      this._processChunk(chunk, objectStart, curIndex + 1, callback);
  }
  _read(size) {
      // DEBUG: Uncomment for debugging help to see what's going on
      //if (this._transforming)
      //    console.error(`_read called during _transform ${this._debugTransformCallCount}`);

      // If a transform has not pushed every line yet, continue that transform
      // otherwise just let the base class implementation do its thing.
      // console.log("++++++++++++++++++++++++++++++++++++++");

      if (!this._transforming && this._tmpCurIndex !== -1) {
          console.log(this._printDebugStats());
          console.log("i'm in rrrrrrrrrrrrrrrrrrrrreeeeeeeeeeeeeeeeaaaaaaaaaaaaadddddddddd");
          this._backpressure = 0;
          this._processChunk(this._tmpChunk, this._tmpObjectStart, this._tmpCurIndex, this._tmpCallback);
          // console.log("current index: ", this._tmpCurIndex);
          this._tmpCurIndex = -1;
      }
      else
          super._read(size);
  }

  _printDebugStats() {
      console.log(
          "done: ", this._done,
          "\npreBlock: ", this._prevBlock,
          "\n_isInString: ", this._isInString,
          "\nthis._isSkipped: ", this._isSkipped,
          "\nthis._level: ", this._level,
          "\nthis._transforming: ", this._transforming,
          "\nthis._tmpCurIndex: ", this._tmpCurIndex,
          "\nthis._tmpObjectStart: ", this._tmpObjectStart,
          "\nthis._tmpChunk: ", this._tmpChunk,
          "\nthis._tmpCallback: ", this._tmpCallback
      );
  }
      // while (curIndex < chunk.length) {
      //     const curValue = String.fromCharCode(chunk[curIndex]);
      //     if (!this._isSkipped) {
      //         switch (curValue) {
      //             case '{':
      //                 // Check if it's in string, we ignore the curly brace in string.
      //                 // Otherwise the object level++.
      //                 if (!this._isInString) {
      //                     this._level++;
      //                 }
      //                 if (!this._isInString && this._level === 2) {
      //                     objectStart = curIndex;
      //                 }
      //                 break;
      //             case '"':
      //                 // Flip the string status
      //                 this._isInString = !this._isInString;
      //                 break;
      //             case '}':
      //                 // check if it's in string
      //                 // if true, do nothing
      //                 // if false and level = 0, push data
      //                 if (!this._isInString) {
      //                     this._level--;
      //                 }
      //                 if (!this._isInString && this._level === 1) {
      //                     // find a object
      //                     const objBuff = Buffer.concat([
      //                         this._prevBlock,
      //                         chunk.slice(objectStart, curIndex + 1),
      //                     ]);
      //                     try {
      //                         // HTTP reponse.ok is true.
      //                         const msgObj = fallbackRest_1.decodeResponse(this.rpc, true, objBuff);
      //                         this.push(msgObj);
      //                     }
      //                     catch (err) {
      //                         this.emit('error', err);
      //                     }
      //                     objectStart = curIndex + 1;
      //                     this._prevBlock = Buffer.from('');
      //                 }
      //                 break;
      //             case ']':
      //                 if (!this._isInString && this._level === 1) {
      //                     this._done = true;
      //                     this.push(null);
      //                 }
      //                 break;
      //             case '\\':
      //                 // Escaping escape character.
      //                 this._isSkipped = true;
      //                 break;
      //             default:
      //                 break;
      //         }
      //     }
      //     else {
      //         this._isSkipped = false;
      //     }
      //     curIndex++;
      // }
      // if (this._level > 1) {
      //     this._prevBlock = Buffer.concat([
      //         this._prevBlock,
      //         chunk.slice(objectStart, curIndex),
      //     ]);
      // }
      // callback();
  _flush(callback) {
      callback();
  }
}

function main() {
  let inStrm = fs.createReadStream("testdata/data.txt", { encoding: "utf8" });
  let transform = new StreamArrayParser();
  pipeline(inStrm, transform, (err) => {
    if (err) {
      console.log('---find err: ', err);
    }
  });
  transform.on('data', (data) => {
    console.log('---data:: ', data);
  });
  transform.on('end', () => {
    console.log('------------stream end;')
  })
  transform.on('close', () => {
    console.log('----stream close');
  })
}

main();
