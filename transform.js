const stream = require('stream');
const fs = require('fs');
const { pipeline } = require('stream');

class StreamArrayParser extends stream.Transform {
    constructor(options) {
        super(Object.assign({}, options, { readableObjectMode: true }));
        this._done = false;
        this._prevBlock = Buffer.from('');
        this._isInString = false;
        this._isSkipped = false;
        this._level = 0;
    }
    _transform(chunk, _, callback) {
        let objectStart = 0;
        let curIndex = 0;
        if (this._level === 0 && curIndex === 0) {
            if (String.fromCharCode(chunk[0]) !== '[') {
                this.emit('error', new Error(`Internal Error: API service stream data must start with a '[' and close with the corresponding ']', but it start with ${String.fromCharCode(chunk[0])}`));
            }
            curIndex++;
            this._level++;
        }
        while (curIndex < chunk.length) {
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
                                if (!this.push(json)) {
                                    console.log('-----------------backpressure');
                                };
                            }
                            catch (err) {
                                this.emit('error', err);
                            }
                            objectStart = curIndex + 1;
                            this._prevBlock = Buffer.from('');
                        }
                        break;
                    case ']':
                        console.log("done");
                        if (!this._isInString && this._level === 1) {
                            this._done = true;
                            console.log("done");
                            this.push(null);
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
            curIndex++;
        }
        if (this._level > 1) {
            this._prevBlock = Buffer.concat([
                this._prevBlock,
                chunk.slice(objectStart, curIndex),
            ]);
        }
        callback();
    }
    _flush(callback) {
        callback();
    }
}

function main() {
  let inStrm = fs.createReadStream("testdata/data.txt", { encoding: "utf8" });
  let transform = new StreamArrayParser();
  let counter = 0;
  pipeline(inStrm, transform, (err) => {
    if (err) {
      console.log('---find err: ', err);
    }
  });
  transform.on('data', (data) => {
    counter++;
    transform.pause();
    process.nextTick(() => {
        transform.resume();
    });
    // console.log('---data:: ', data);
  });
  transform.on('end', () => {
    console.log('How many data object:: ', counter);
    console.log('------------stream end;')
  })
  transform.on('close', () => {
    console.log('----stream close');
  })
}

main();
