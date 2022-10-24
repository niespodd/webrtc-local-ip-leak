importScripts('https://unpkg.com/fflate@0.7.4/umd/index.js');

let lookupTable = {};

async function streamToArrayBuffer(stream) {
    let result = new Uint8Array(0);
    const reader = stream.getReader();
    while (true) { // eslint-disable-line no-constant-condition
        const {done, value} = await reader.read();
        if (done) {
            break;
        }

        const newResult = new Uint8Array(result.length + value.length);
        newResult.set(result);
        newResult.set(value, result.length);
    }
    return result;
}

onmessage = async function ({data}) {
    console.log('worker recv', data);

    if (data.method === "loadLookup") {
        postMessage({
            method: "loadLookupComplete",
            count: Object.keys(lookupTable).length,
        });
    }

    if (data.method === "lookup") {
        const {foundation} = data;
        const chunkId = parseInt(foundation.substring(foundation.length - 3)).toString();
        const res = await fetch(`db/${chunkId}.json.gz`, {headers: {'Content-Encoding': 'gzip'}});
        const compressed = new Uint8Array(await res.arrayBuffer());
        const decompressed = fflate.decompressSync(compressed);
        const text = fflate.strFromU8(decompressed);

        for (const row of text.split("\n")) {
            const [foundation, paramsRaw] = row.split("=");
            if (!paramsRaw || !foundation) continue;
            const params = paramsRaw.split(":");
            lookupTable[foundation] = {
                address: params[0],
                protocol: params[1],
                type: params[2],
            }
        }

        postMessage({
            method: "lookupResult",
            foundation,
            result: lookupTable[foundation] || "unknown",
        });
    }
}

