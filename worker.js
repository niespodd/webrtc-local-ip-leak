let lookupTable = {};

onmessage = async function ({data}) {
    if (data.method === "loadLookup") {
        const res = await fetch('/lookup.json');
        const text = await res.text();
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
            method: "loadLookupComplete",
            count: Object.keys(lookupTable).length,
        });
    }

    if (data.method === "lookup") {
        const {foundation} = data;
        postMessage({
            method: "lookupResult",
            foundation,
            result: lookupTable[foundation] || "unknown",
        });
    }
}

