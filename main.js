const gatherIceCandidates = () => {
    return new Promise(async resolve => {
        let candidates = [];
        const rtc = new RTCPeerConnection();

        rtc.createDataChannel("");
        const offer = await rtc.createOffer();
        await rtc.setLocalDescription(offer);

        const id = setTimeout(() => {
            rtc.onicecandidate = null;
            resolve(candidates);
        }, 12000);
        rtc.onicecandidate = (event) => {
            if (!event.candidate) {
                resolve(candidates);
                return clearTimeout(id);
            }
            candidates.push({
                foundation: event.candidate.foundation,
                protocol: event.candidate.protocol,
                address: event.candidate.address,
            });
        };
    });
}

window.addEventListener('load', () => {
    const loading = document.querySelector("#loading");
    const loadingStatus = document.querySelector("#loadingStatus");
    const setLoadingStatus = (statusText = '', complete = false, error = false) => {
        if (!complete) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
        loadingStatus.innerText = statusText;
    }

    const candidatesTable = document.querySelector("#candidatesTable");
    let tableData = {candidates: []};
    const updateTable = () => {
        const tBody = candidatesTable.querySelector("tbody");
        tBody.innerHTML = '';

        if (tableData.candidates.length > 0) {
            candidatesTable.classList.remove('hidden');
        }

        for (let candidate of tableData.candidates) {
            const sepRow = document.createElement("tr");
            sepRow.innerHTML = `<td colspan="3" style="height: 2px; background: #e2e8f0; padding: 0;"></td>`;
            tBody.appendChild(sepRow);

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${candidate.foundation}</td>
                <td class="whitespace-nowrap overflow-hidden text-ellipsis" title="${candidate.address}">
                    ${candidate.address}
                </td>
                <td>${candidate.protocol.toUpperCase()}</td>
            `;
            tBody.appendChild(row);

            const detailRow = document.createElement("tr");
            if (candidate.result === "unknown") {
                detailRow.innerHTML = `
                    <td colspan="3">
                        ❌ Lookup failed. Perhaps this is not a local IP?                        
                    </td>`;
            } else if (!candidate.result) {
                detailRow.innerHTML = `
                    <td colspan="3">
                        ⌛ Hang on...             
                    </td>`;
            } else {
                detailRow.innerHTML = `
                    <td colspan="3">
                        🧬 Address <span class="font-medium">${candidate.result.address}</span>,
                            protocol <span class="font-medium">${candidate.result.protocol.toUpperCase()}</span>,
                            type <span class="font-medium">${candidate.result.type}</span>
                        ${candidate.result.address.startsWith("172") ? `
                            <br />
                            <div class="mt-[.5rem] text-xs font-medium bg-red-50 rounded py-[.25rem] px-[.5rem] w-max">
                                🚨 &nbsp; This may be a local subnet for WSL, but no guarantee
                            </div>
                        `: ''} 
                    </td>`;
            }
            tBody.appendChild(detailRow);
        }
    }

    const lookupStats = document.querySelector("#lookupStats");

    const actionButton = document.querySelector("#actionButton");
    actionButton.addEventListener('click', async () => {
        try {
            actionButton.style.display = 'none';

            setLoadingStatus("Gather ICE candidates...");
            tableData.candidates = await gatherIceCandidates();
            updateTable();

            setLoadingStatus("Lookup foundation keys...");
            const worker = new Worker('worker.js');

            await new Promise(resolve => setTimeout(resolve, 2000));

            worker.addEventListener('message', ({data}) => {
                if (data.method !== "lookupResult") {
                    return;
                }

                for (let i = 0; i < tableData.candidates.length; i++) {
                    if (tableData.candidates[i].foundation === data.foundation) {
                        tableData.candidates[i].result = data.result;
                    }
                }
            })

            for (let i = 0; i < tableData.candidates.length; i++) {
                worker.postMessage({method: "lookup", foundation: tableData.candidates[i].foundation});
            }

            await new Promise(resolve => setTimeout(resolve, 2500));

            setTimeout(() => worker.postMessage({method: "loadLookup"}), 500);
            await new Promise((resolve, reject) => {
                const handleMessage = ({data}) => {
                    console.log('main recv', data);
                    if (data.method === "loadLookupComplete") {
                        lookupStats.classList.remove('hidden');
                        lookupStats.innerHTML = `✅ Used ${new Intl.NumberFormat().format(data.count)} keys for lookups`;
                        resolve();
                    }
                    worker.removeEventListener('message', handleMessage);
                }
                worker.addEventListener('message', handleMessage);
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            updateTable();

            setLoadingStatus(undefined, true, undefined);
        } catch (err) {
            setLoadingStatus(err.toString());
        }
    })
});
