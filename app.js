document.addEventListener('DOMContentLoaded', () => {
    const savedKey = localStorage.getItem('groqApiKey');
    if (savedKey) {
        document.getElementById('api-key').value = savedKey;
    }
});

document.getElementById('api-key').addEventListener('input', function(event) {
    localStorage.setItem('groqApiKey', event.target.value.trim());
});

document.getElementById('case-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const caseData = JSON.parse(e.target.result);
                loadCase(caseData);
            } catch (error) {
                alert('Erro ao carregar o arquivo JSON. Verifique o formato.');
            }
        };
        reader.readAsText(file);
    }
});

let currentCase = null;
let clockInterval = null;
let simTime = 0;
let chatHistory = [];
let currentVitals = {};

function loadCase(data) {
    currentCase = data;
    document.getElementById('app-container').classList.remove('hidden');

    document.getElementById('patient-name').innerText = data.patient.name;
    document.getElementById('patient-age').innerText = data.patient.age;
    document.getElementById('patient-gender').innerText = data.patient.gender;
    document.getElementById('patient-weight').innerText = data.patient.weight;

    document.getElementById('cc').innerText = data.history.main_complaint;
    document.getElementById('hma').innerText = data.history.hma;
    document.getElementById('comorbidities').innerText = data.history.comorbidities.join(', ');
    document.getElementById('allergies').innerText = data.history.allergies.join(', ');

    document.getElementById('physical-exam-text').innerText = data.physical_exam;

    updateMonitor(data.initial_vitals);
    document.getElementById('exam-results-list').innerHTML = '';

    document.getElementById('action-log').innerHTML = '';
    addAction('Caso iniciado.');

    initAI(data);

    simTime = 0;
    if(clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => { 
        simTime++; 
        updateDynamicMonitor();
    }, 1000);
}

function updateMonitor(vitals) {
    currentVitals = { ...currentVitals, ...vitals };
    
    document.getElementById('vital-rr').innerText = currentVitals.rr || '--';
    document.getElementById('vital-temp').innerText = currentVitals.temp || '--';
    
    document.getElementById('vital-hr').innerText = currentVitals.hr || '--';
    document.getElementById('vital-spo2').innerText = currentVitals.spo2 || '--';

    if (document.getElementById('vital-bp').innerText === '--') {
        document.getElementById('vital-bp').innerText = currentVitals.bp || '--';
    }
}

function updateDynamicMonitor() {
    if (currentVitals.hr && currentVitals.hr !== '--') {
        const hrBase = parseInt(currentVitals.hr);
        const varHr = Math.floor(Math.random() * 5) - 2; // Oscila de -2 a +2 bpm
        document.getElementById('vital-hr').innerText = hrBase + varHr;
    }
    
    if (currentVitals.spo2 && currentVitals.spo2 !== '--') {
        const spo2Base = parseInt(currentVitals.spo2);
        let varSpo2 = Math.floor(Math.random() * 3) - 1; // Oscila de -1 a +1 %
        let newSpo2 = spo2Base + varSpo2;
        document.getElementById('vital-spo2').innerText = newSpo2 > 100 ? 100 : newSpo2;
    }
}

function measureBP() {
    const bpElement = document.getElementById('vital-bp');
    if (bpElement.innerText === 'Aferindo...') return; 
    
    bpElement.innerText = 'Aferindo...';
    addAction('Aferindo pressão arterial não invasiva...');
    
    setTimeout(() => {
        bpElement.innerText = currentVitals.bp || '--';
        addAction(`Pressão arterial aferida: ${currentVitals.bp}`);
    }, 4000); // 4 segundos simulando o tempo do manguito inflando
}

function showPanel(panelName) {
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById('panel-' + panelName).classList.add('active');
}

function addAction(description) {
    const log = document.getElementById('action-log');
    const li = document.createElement('li');

    const minutes = String(Math.floor(simTime / 60)).padStart(2, '0');
    const seconds = String(simTime % 60).padStart(2, '0');

    li.innerHTML = `<strong>[${minutes}:${seconds}]</strong> ${description}`;
    log.appendChild(li);
    log.parentElement.scrollTop = log.parentElement.scrollHeight;
}

function initAI(caseData) {
    console.log("[DEBUG] Inicializando IA com os dados do caso:", caseData);
    chatHistory = [
        {
            role: "system",
            content: `Você é uma IA com duas personalidades para uma simulação médica.

PERSONALIDADE 1: MOTOR DE SIMULAÇÃO (Padrão)
- Quando o usuário envia uma "Conduta realizada:", você age como o motor da simulação.
- Você avalia a conduta e retorna o impacto no paciente.
- Se a conduta solicitada for um exame (ex: ECG, Raio-X, exames de sangue), inclua os achados descritivos no campo "exam_report".
- Sua resposta DEVE ser um JSON com a estrutura: {"feedback_message": "...", "vitals": {...}, "exam_report": "Laudo detalhado (opcional)"}

PERSONALIDADE 2: O PACIENTE
- Quando o usuário envia uma pergunta iniciada por "Como paciente, responda:", você assume o papel do paciente.
- Você deve responder à pergunta do médico baseando-se estritamente nos dados do caso fornecidos abaixo. Não invente informações. Se a informação não estiver disponível, responda que não sabe ou não se lembra.
- Sua resposta DEVE ser um JSON com a estrutura: {"patient_answer": "Sua resposta como paciente aqui."}

Dados do caso para ambas as personalidades:
${JSON.stringify(caseData, null, 2)}

Responda SEMPRE e ESTRITAMENTE no formato JSON solicitado para a personalidade apropriada.`
        }
    ];
}

async function callGroqAPI(prompt) {
    const apiKey = document.getElementById('api-key').value.trim();
    console.log(`[DEBUG] Iniciando chamada API Groq.`);
    console.log(`[DEBUG] Prompt do usuário: "${prompt}"`);
    console.log(`[DEBUG] Tamanho da API Key fornecida: ${apiKey.length} caracteres.`);

    if (!apiKey) {
        alert("Por favor, insira a chave da API do Groq no topo da página.");
        console.error("[ERRO] Chave da API vazia.");
        return null;
    }

    if (!apiKey.startsWith('gsk_') || apiKey.length > 100) {
        alert("A chave da API parece inválida. Chaves da Groq começam com 'gsk_' e possuem cerca de 56 caracteres. Verifique se copiou a chave correta.");
        console.error(`[ERRO] Formato de API Key suspeito (Tamanho: ${apiKey.length}, Começa com gsk_: ${apiKey.startsWith('gsk_')})`);
        return null;
    }

    chatHistory.push({ role: "user", content: prompt });

    const requestBody = {
        model: "llama-3.3-70b-versatile", // Modelo atualizado e suportado pela Groq
        messages: chatHistory,
        response_format: { type: "json_object" },
        temperature: 0.2
    };

    console.log("[DEBUG] Payload da requisição (JSON):", JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        console.log(`[DEBUG] Status da resposta HTTP: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("[ERRO] Corpo da resposta de erro da API:", errorBody);
            throw new Error(`Erro na API: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        console.log("[DEBUG] Resposta de sucesso da API (Parsed):", data);

        const aiMessage = data.choices[0].message.content;
        
        chatHistory.push({ role: "assistant", content: aiMessage });
        return JSON.parse(aiMessage);
    } catch (error) {
        console.error("[ERRO CRÍTICO] Falha ao comunicar com a Groq:", error);
        alert("Erro de comunicação com a IA. Verifique sua chave de API e o console para detalhes.");
        chatHistory.pop();
        return null;
    }
}

async function performAction(actionDescription) {
    addAction(`Solicitado: ${actionDescription}`);
    
    console.log(`[DEBUG] performAction foi chamada com a ação: "${actionDescription}"`);
    const loadingLi = document.createElement('li');
    loadingLi.innerHTML = `<em>IA analisando conduta...</em>`;
    loadingLi.id = 'loading-ai';
    document.getElementById('action-log').prepend(loadingLi);

    const aiResponse = await callGroqAPI(`Conduta realizada: ${actionDescription}`);
    
    const loader = document.getElementById('loading-ai');
    if (loader) loader.remove();

    if (aiResponse) {
        if (aiResponse.feedback_message) addAction(`Evolução: ${aiResponse.feedback_message}`);
        if (aiResponse.vitals) updateMonitor(aiResponse.vitals);
        if (aiResponse.exam_report) {
            showExamResult(actionDescription, aiResponse.exam_report);
        }
    }
}

function showExamResult(actionName, report) {
    const list = document.getElementById('exam-results-list');
    const card = document.createElement('div');
    card.style.background = '#f9f9f9';
    card.style.border = '1px solid #ddd';
    card.style.padding = '15px';
    card.style.marginBottom = '15px';
    card.style.borderRadius = '5px';

    let content = `<h5>${actionName}</h5><p style="margin-top: 5px; font-size: 0.95em;">${report}</p>`;
    
    card.innerHTML = content;
    list.prepend(card);
}

async function askPatient() {
    const questionInput = document.getElementById('anamnesis-question');
    const question = questionInput.value.trim();
    if (!question) return;

    addAnamnesisLog(question, 'user');
    questionInput.value = '';
    questionInput.disabled = true;

    const thinkingElement = addAnamnesisLog('Paciente pensando...', 'patient');
    thinkingElement.classList.add('thinking');

    const prompt = `Como paciente, responda à seguinte pergunta do médico: "${question}"`;
    const aiResponse = await callGroqAPI(prompt);

    thinkingElement.remove();
    questionInput.disabled = false;
    questionInput.focus();

    if (aiResponse && aiResponse.patient_answer) {
        addAnamnesisLog(aiResponse.patient_answer, 'patient');
    } else {
        addAnamnesisLog('O paciente parece confuso e não consegue responder no momento.', 'patient');
        console.error("AI response for patient question was invalid:", aiResponse);
    }
}

function addAnamnesisLog(message, sender) {
    const log = document.getElementById('anamnesis-log');
    const entry = document.createElement('div');
    entry.textContent = message;
    entry.className = `chat-entry ${sender}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    return entry;
}

function administerMed() {
    const route = document.getElementById('med-route').value;
    const name = document.getElementById('med-name').value;
    if(name.trim() !== '') {
        const actionDesc = `Medicamento administrado: ${name} (${route})`;
        document.getElementById('med-name').value = '';
        performAction(actionDesc);
    } else {
        alert('Digite o nome do medicamento e a dose.');
    }
}