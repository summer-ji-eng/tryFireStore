const stream = require('stream');
const fs = require('fs');
const { pipeline } = require('stream');

class LineTransform extends stream.Transform
{
    constructor(options)
    {
        super(options);

        this._lastLine = "";
        this._continueTransform = null;
        this._transforming = false;
        this._debugTransformCallCount = 0;
    }

    _transform(chunk, encoding, callback)
    {
        if (encoding === "buffer")
            return callback(new Error("Buffer chunks not supported"));

        if (this._continueTransform !== null)
            return callback(new Error("_transform called before previous transform has completed."));

        // DEBUG: Uncomment for debugging help to see what's going on
        console.error(`${++this._debugTransformCallCount} _transform called:`);

        // Guard (so we don't call _continueTransform from _read while it is being
        // invoked from _transform)
        this._transforming = true;

        // Do our transforming (in this case splitting the big chunk into lines)
        let lines = (this._lastLine + chunk).split(/\r\n|\n/);
        this._lastLine = lines.pop();

        // In order to respond to "back pressure" create a function
        // that will push all of the lines stopping when push returns false,
        // and then resume where it left off when called again, only calling
        // the "callback" once all lines from this transform have been pushed.
        // Resuming (until done) will be done by _read().
        let nextLine = 0;
        this._continueTransform = () =>
            {
                let backpressure = false;
                let line = "";
                while (nextLine < lines.length)
                {
                    // console.log("bp: " + backpressure, " nextLine: ", nextLine);
                    console.log("normal processing: ", nextLine);
                  // this.push(lines[nextLine++] + "\n")
                  line += lines[nextLine++];
                  let data = line + "\n";
                    if (!this.push(data))
                    {
                        return;
                        // console.log('---fail to push the data')
                        // console.log("bp: " + backpressure, " nextLine: ", nextLine);
                        // we've got more to push, but we got backpressure so it has to wait.
                        // if (backpressure)
                        //     return;

                        // line += lines[nextLine++];
                        // data = line + "\n";
                        // backpressure = !this.push(data);
                    }
                }

                // DEBUG: Uncomment for debugging help to see what's going on
                console.error(`_continueTransform ${this._debugTransformCallCount} finished\n`);

                // All lines are pushed, remove this function from the LineTransform instance
                this._continueTransform = null;
                return callback();
            };

        // Start pushing the lines
        this._continueTransform();

        // Turn off guard allowing _read to continue the transform pushes if needed.
        this._transforming = false;
    }

    _flush(callback)
    {
        console.log('---flush has been called');
        if (this._lastLine.length > 0)
        {
            this.push(this._lastLine);
            this._lastLine = "";
        }

        return callback();
    }

    _read(size)
    {
        // DEBUG: Uncomment for debugging help to see what's going on
        if (this._transforming)
           console.error(`_read called during _transform ${this._debugTransformCallCount}`);

        // If a transform has not pushed every line yet, continue that transform
        // otherwise just let the base class implementation do its thing.
        if (!this._transforming && this._continueTransform !== null) {
            console.error(`_read called after backpressure ${this._debugTransformCallCount}`);
            this._continueTransform();
        }
        else
            super._read(size);
    }
}

function main() {
  let inStrm = fs.createReadStream("testdata/largefile.txt", { encoding: "utf8" });
  let lineStrm = new LineTransform({ encoding: "utf8", decodeStrings: false });
  inStrm.pipe(lineStrm).pipe(fs.createWriteStream("testdata/result.txt"));
  pipeline(inStrm, lineStrm, (err) => {
    if (err) {
      console.log('---find err: ', err);
    }
  });
  lineStrm.on('data', (data) => {
    // console.log('---data:: ', data);
  });
  lineStrm.on('end', () => {
    console.log('------------stream end;')
  })
  lineStrm.on('close', () => {
    console.log('----stream close');
  })
}

main();

