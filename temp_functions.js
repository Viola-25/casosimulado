// --- FUNÇÕES DE CRIAÇÃO DE CASO --- //

function showCaseCreator() {
    document.getElementById('case-creator').classList.remove('hidden');
    document.getElementById('simulator-interface').classList.add('hidden');
}

function createCaseFromForm() {
    const form = document.getElementById('creator-form');
    const formData = new FormData(form);

    // Validar campos obrigatórios
    const requiredFields = ['difficulty', 'patient-name', 'patient-age', 'patient-gender', 'case-description', 'main-complaint'];
    const missingFields = requiredFields.filter(field => !formData.get(field)?.trim());

    if (missingFields.length > 0) {
        alert(Por favor, preencha os seguintes campos obrigatórios: );
        return;
    }

    // Construir objeto do caso
    const caseData = {
        difficulty: formData.get('difficulty'),
        patient: {
            name: formData.get('patient-name'),
            age: formData.get('patient-age'),
            gender: formData.get('patient-gender'),
            weight: formData.get('patient-weight') || 'Não informado'
        },
        case: formData.get('case-description'),
        main_complaint: formData.get('main-complaint'),
        observations: formData.get('observations') || '',
        ai_instructions: formData.get('ai-instructions') || ''
    };

    // Carregar o caso criado
    loadCase(caseData);

    // Esconder criador e mostrar simulador
    document.getElementById('case-creator').classList.add('hidden');
    document.getElementById('simulator-interface').classList.remove('hidden');

    // Limpar formulário
    form.reset();
}

function extractVitalsFromCase(caseText) {
    if (!caseText) return {};

    const vitals = {};
    const patterns = {
        hr: /FC\s*(\d+)/i,
        bp: /PA\s*([\d\/]+)/i,
        spo2: /SpO2\s*(\d+)/i,
        rr: /FR\s*(\d+)/i,
        temp: /Temp\s*([\d\.]+)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
        const match = caseText.match(pattern);
        if (match) {
            vitals[key] = match[1];
        }
    }

    return vitals;
}
