document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
});


// Endpoint API
const SENSOR_LOG_API = "https://n8n-35yaee339qxb.jkt6.sumopod.my.id/webhook/2a2f8171-6279-4735-9c18-a0f9b64f8f22";
const ROWS_PER_PAGE = 5;

// Sensor Log
let sensorLogData = [];
let sensorLogPage = 1;

// MQTT GLOBAL
let MQTT_CONFIG = null;
let client = null;
let mqttConnected = false;
let ESP32Connected = false;




// ================= MODAL FUNCTIONS ==================
function openModal(modalId) {
    const modal = document.getElementById(modalId);

    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);

    if (!modal) return;
    modal.classList.remove("flex");
    modal.classList.add("hidden");
}

// ================= CHART ========================
const ctx = document.getElementById('myChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [], // Akan diisi oleh timestamp waktu
        datasets: [
            {
                label: 'TDS (ppm)',
                borderColor: '#38BDF8', // Biru terang
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                data: [],
                borderWidth: 2,
                tension: 0.3
            },
            {
                label: 'Turbidity (NTU)',
                borderColor: '#FB7185', // Merah muda/Rose
                backgroundColor: 'rgba(251, 113, 133, 0.1)',
                data: [],
                borderWidth: 2,
                tension: 0.3
            },
            {
                label: 'Soil Moist (%)',
                borderColor: '#34D399', // Hijau emerald
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                data: [],
                borderWidth: 2,
                tension: 0.3
            },
            {
                label: 'Temp (°C)',
                borderColor: '#FBBF24', // Kuning amber
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                data: [],
                borderWidth: 2,
                tension: 0.3
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
    }
});

// ================= DUMMY MODE =================
function startDummy() {
    setInterval(() => {

        const tds = +(100 + Math.random() * 400).toFixed(0);        // Rentang 100 - 500 ppm
        const turbidity = +(1.0 + Math.random() * 9.0).toFixed(2);  // Rentang 1.0 - 10.0 NTU
        const soilMoisture = +(30 + Math.random() * 50).toFixed(0); // Rentang 30% - 80%
        const temp = +(24.0 + Math.random() * 11.0).toFixed(1);     // Rentang 24.0°C - 35.0°C
        const rain = +(0 + Math.random() * 0.9).toFixed(0);         // Rentang 0 - 1
        const hum = +(60 + Math.random() * 38).toFixed(1);
        updateMultiParameters(tds, turbidity, soilMoisture, temp, hum, rain);

    }, 3000);
}

// ================= UPDATE FUNCTION =================
function setStatus(element, icon, text, color) {

    const colors = {
        green: {
            badge: "bg-green-900/30 border border-green-700 text-green-300",
            icon: "text-green-300"
        },
        yellow: {
            badge: "bg-amber-900/30 border border-amber-700 text-amber-300",
            icon: "text-amber-300"
        },
        red: {
            badge: "bg-red-900/30 border border-red-700 text-red-300",
            icon: "text-red-300"
        },
        blue: {
            badge: "bg-sky-900/30 border border-sky-700 text-sky-300",
            icon: "text-sky-300"
        }
    };

    element.className = `flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colors[color].badge}`;
    element.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 ${colors[color].icon}"></i><span>${text}</span>`;

    lucide.createIcons();
}

function updateMultiParameters(tds, turbidity, soilMoisture, temp, hum, rain) {

    // --- Update Angka pada HTML ---
    if (document.getElementById("tdsValue")) {
        document.getElementById("tdsValue").innerHTML = tds;
    }
    if (document.getElementById("turbidityValue")) {
        document.getElementById("turbidityValue").innerHTML = turbidity.toFixed(2);
    }
    if (document.getElementById("soilValue")) {
        document.getElementById("soilValue").innerHTML = soilMoisture;
    }
    if (document.getElementById("tempValue")) {
        document.getElementById("tempValue").innerHTML = temp.toFixed(1);
    }
    if (document.getElementById("humValue")) {
        document.getElementById("humValue").innerHTML = hum.toFixed(1);
    }

    // --- Update Data pada Single Chart ---
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Tambah label waktu baru ke grafik
    chart.data.labels.push(timestamp);

    // Push ke masing-masing index dataset (0: TDS, 1: Turbidity, 2: Soil, 3: Temp)
    chart.data.datasets[0].data.push(tds);
    chart.data.datasets[1].data.push(turbidity);
    chart.data.datasets[2].data.push(soilMoisture);
    chart.data.datasets[3].data.push(temp);

    // Batasi data maksimal 15 titik saja agar grafik tidak menumpuk ketat
    if (chart.data.labels.length > 15) {
        chart.data.labels.shift();          // Hapus label waktu terlama
        chart.data.datasets[0].data.shift(); // Hapus data TDS terlama
        chart.data.datasets[1].data.shift(); // Hapus data Turbidity terlama
        chart.data.datasets[2].data.shift(); // Hapus data Soil terlama
        chart.data.datasets[3].data.shift(); // Hapus data Temp terlama
    }


    // Update status parameter
    const tdsStatus = document.getElementById("tdsStatus");
    const turbidityStatus = document.getElementById("turbidityStatus");
    const soilStatus = document.getElementById("soilStatus");
    const tempStatus = document.getElementById("tempStatus");

    const rainValue = document.getElementById("rainValue");
    const rainIcon = document.getElementById("rainIcon");


    if (tds < 500) {
        setStatus(tdsStatus, "circle-check", "Safe", "green");
    }
    else if (tds <= 1000) {
        setStatus(tdsStatus, "triangle-alert", "Warning", "yellow");
    }
    else {
        setStatus(tdsStatus, "shield-alert", "Danger", "red");
    }

    if (turbidity < 5) {
        setStatus(turbidityStatus, "droplets", "Clear", "green");
    }
    else if (turbidity <= 25) {
        setStatus(turbidityStatus, "eye-off", "Turbid", "yellow");
    }
    else {
        setStatus(turbidityStatus, "shield-alert", "Hazard", "red");
    }

    if (soilMoisture < 40) {
        setStatus(soilStatus, "sun", "Dry", "yellow");
    }
    else if (soilMoisture <= 70) {
        setStatus(soilStatus, "sprout", "Optimal", "green");
    }
    else {
        setStatus(soilStatus, "waves", "Wet", "blue");
    }

    if (temp < 18) {
        setStatus(tempStatus, "snowflake", "Cold", "blue");
    }
    else if (temp <= 32) {
        setStatus(tempStatus, "sun-dim", "Warm", "yellow");
    }
    else {
        setStatus(tempStatus, "flame", "Hot", "red");
    }

    if (rain == 0) {
        rainValue.textContent = "Rain";

        rainValue.classList.remove("text-amber-400");
        rainValue.classList.add("text-blue-400");

        rainIcon.innerHTML = `
            <i
                data-lucide="cloud-rain"
                class="w-8 h-8 text-blue-400">
            </i>
        `;
    } else {
        rainValue.textContent = "No Rain";

        rainValue.classList.remove("text-blue-400");
        rainValue.classList.add("text-amber-400");

        rainIcon.innerHTML = `
            <i
                data-lucide="cloud-sun"
                class="w-8 h-8 text-amber-400">
            </i>
        `;
    }

    // Render ulang icon Lucide
    lucide.createIcons();
    chart.update();
}



// ================ SENSOR LOG ==================
function renderLogPagination() {

    const totalPages = Math.ceil(sensorLogData.length / ROWS_PER_PAGE);
    const div = document.getElementById("sensorLogPagination");

    div.innerHTML = "";

    if (totalPages <= 1) return;
    let html = "";

    html += `
        <button
            onclick="changeLogPage(${sensorLogPage - 1})"
            ${sensorLogPage == 1 ? "disabled" : ""}
            class="px-3 py-1 border rounded disabled:opacity-50">
            Prev
        </button>
    `;

    let start = Math.max(1, sensorLogPage - 2);
    let end = Math.min(totalPages, sensorLogPage + 2);

    if (start > 1) {
        html += `
            <button onclick="changeLogPage(1)"
                class="px-3 py-1 border rounded">
                1
            </button>
        `;

        if (start > 2) {
            html += `<span class="px-2">...</span>`;
        }
    }

    for (let i = start; i <= end; i++) {

        html += `
            <button
                onclick="changeLogPage(${i})"
                class="px-3 py-1 rounded
                ${i == sensorLogPage
                ? "bg-cyan-600 text-white"
                : "border"}">
                ${i}
            </button>
        `;
    }

    if (end < totalPages) {

        if (end < totalPages - 1) {
            html += `<span class="px-2">...</span>`;
        }

        html += `
            <button onclick="changeLogPage(${totalPages})"
                class="px-3 py-1 border rounded">
                ${totalPages}
            </button>
        `;
    }

    html += `
        <button
            onclick="changeLogPage(${sensorLogPage + 1})"
            ${sensorLogPage == totalPages ? "disabled" : ""}
            class="px-3 py-1 border rounded disabled:opacity-50">
            Next
        </button>
    `;

    div.innerHTML = html;
}

function renderSensorLog() {
    const tbody = document.getElementById("sensorLogBody");

    const start = (sensorLogPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;

    const pageData = sensorLogData.slice(start, end);
    let html = "";
    let no = start + 1;

    pageData.forEach(item => {

        html += `
                <tr class="border-b">

                    <td class="text-center">
                        ${no++}
                    </td>

                    <td class="text-center py-2">
                        ${item.log_timestamp}
                    </td>

                    <td class="text-center">
                        ${item.tds}
                    </td>

                    <td class="text-center">
                        ${item.turbidity}
                    </td>

                    <td class="text-center">
                        ${item.soil_moist}
                    </td>

                    <td class="text-center">
                        ${item.temp}
                    </td>

                </tr>
        `;
    });

    tbody.innerHTML = html;
    renderLogPagination();

}

function changeLogPage(page) {
    const totalPages = Math.ceil(sensorLogData.length / ROWS_PER_PAGE);

    if (page < 1) return;
    if (page > totalPages) return;

    sensorLogPage = page;
    renderSensorLog();
}

async function loadSensorLog() {

    try {
        const response = await fetch(SENSOR_LOG_API, {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Gagal mengambil data sensor log");
        }

        const data = await response.json();
        // console.log(data);
        sensorLogData = data;
        renderSensorLog();

    }
    catch (err) {
        console.error(err);
    }
}

// ================= MQTT CONFIG =================
const MQTT_CONFIG_API = "https://n8n-35yaee339qxb.jkt6.sumopod.my.id/webhook/d8eabc68-63e2-41f7-b9a1-491abf3e152d";

async function loadMQTTConfig() {
    try {
        const response = await fetch(MQTT_CONFIG_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                request: "mqtt_config"
            })
        });
        const config = await response.json();

        MQTT_CONFIG = {
            url: `wss://${config.broker}:${config.port}/mqtt`,
            clientId: "web_" + Math.random().toString(16).substr(2, 8),
            topicSensor: config.sensor_topic,
            topicStatus: config.status_topic
        };

        const sensorTopic =
            config.sensor_topic.substring(
                config.sensor_topic.lastIndexOf("/") + 1
            );

        const statusTopic =
            config.status_topic.substring(
                config.status_topic.lastIndexOf("/") + 1
            );

        document.getElementById("mqttBroker").value = config.broker;
        document.getElementById("mqttPort").value = config.port;
        document.getElementById("sensorTopic").value = sensorTopic;
        document.getElementById("statusTopic").value = statusTopic;

        console.log("MQTT CONFIG", MQTT_CONFIG);
        connectMQTT();
    }
    catch (error) {
        console.log("Config error:", error);
    }
}


function connectMQTT() {
    client = mqtt.connect(
        MQTT_CONFIG.url,
        {
            clientId: MQTT_CONFIG.clientId,
            clean: true,
            connectTimeout: 4000
        }
    );

    client.on("connect", () => {
        console.log("MQTT Connected");

        mqttConnected = true;
        client.subscribe([MQTT_CONFIG.topicSensor, MQTT_CONFIG.topicStatus]);

        const el = document.getElementById("mqttStatus");

        if (el) {
            el.innerHTML = "● Connected";
            el.className = "bg-slate-800 text-emerald-400 px-4 py-1 rounded-full border border-emerald-500 font-medium shadow shadow-emerald-900/30";
        }
    });

    // DISCONNECT
    client.on("disconnect", () => {
        mqttConnected = false;
        const el = document.getElementById("mqttStatus");

        if (el) {
            el.innerHTML = "● Disconnected";
            el.className = "bg-slate-800 text-red-400 px-4 py-1 rounded-full border border-red-500 font-medium shadow shadow-red-900/30";
        }

    });

    // MESSAGE
    client.on("message", (topic, message) => {

        const data = JSON.parse(message.toString());
        // if (topic === MQTT_CONFIG.topicSensor) {
        //     updateMultiParameters(data.tds, data.turbidity, data.soilMoisture, data.temp, data.hum, data.rain)
        //     return;
        // }
        if (data.mode === "sensor") {
            updateMultiParameters(
                data.tds,
                data.turbidity,
                data.soilMoisture,
                data.temp,
                data.hum,
                data.rain
            );
        }

        // ESP32 STATUS
        if (topic === MQTT_CONFIG.topicStatus) {
            const espStatus = document.getElementById("espStatus");
            const esp32Status = data.status;
            if (esp32Status == "online") {
                ESP32Connected = true;
                espStatus.innerHTML = "● Online";
                espStatus.className = "bg-slate-800 text-emerald-400 px-4 py-1 rounded-full border border-emerald-500 font-medium shadow shadow-emerald-900/30";
            } else {
                ESP32Connected = false;
                espStatus.innerHTML = "● Offline";
                espStatus.className = "bg-slate-800 text-red-400 px-4 py-1 rounded-full border border-red-500 font-medium shadow shadow-red-900/30";
            }

            console.log("ESP32 Status:", esp32Status);
        }
    });
}


async function saveMqttConfig() {
    let mqtt_broker = document.getElementById("mqttBroker").value;
    let mqtt_port = document.getElementById("mqttPort").value;
    let sensor_topic = "rizkyproject/alkauni_sensor/" + document.getElementById("sensorTopic").value;
    let status_topic = "rizkyproject/alkauni_status/" + document.getElementById("statusTopic").value;

    const payload = {
        broker: mqtt_broker,
        port: Number(mqtt_port),
        sensor_topic: sensor_topic,
        status_topic: status_topic
    };

    console.log("Data dikirim:", payload);

    try {
        const response = await fetch(MQTT_CONFIG_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        console.log("Response API:", result);
        alert("Data Konfigurasi MQTT Berhasil Disimpan!");
        // location.reload();
    }

    catch (error) {
        console.error("Gagal kirim config:", error);
        alert("Gagal menyimpan MQTT Config");
    }
}

function toggleRelay(state) {

    const toggleIcon = document.getElementById("toggleIcon");

    const payload = {
        mode: "relay",
        state: state ? 1 : 0
    };

    if (state) {
        toggleIcon.innerHTML =
            `<i data-lucide="power" class="w-7 h-7 text-emerald-400 transition-colors duration-300"></i>`;
    } else {
        toggleIcon.innerHTML =
            `<i data-lucide="power" class="w-7 h-7 text-red-400 transition-colors duration-300"></i>`;
    }

    client.publish(
        MQTT_CONFIG.topicSensor,
        JSON.stringify(payload)
    );

    lucide.createIcons();
}

loadMQTTConfig();
loadSensorLog();


setInterval(() => {
    loadSensorLog();
}, 5000);
