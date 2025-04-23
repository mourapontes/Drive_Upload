const CLIENT_ID = '48022589399-aanp4sbe9fpndq4b8bdob74ga5efpbjs.apps.googleusercontent.com';
const API_KEY = 'AIzaSyArVupmbRbZny7nmjb-Wzomh53cGdTulm4';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;

document.getElementById('authorize_button').style.visibility = 'hidden';
document.getElementById('signout_button').style.visibility = 'hidden';

window.addEventListener('error', (event) => {
    console.error('Erro ao carregar as bibliotecas:', event.message);
    document.getElementById('content').innerText = 'Erro ao carregar as bibliotecas do Google. Verifique sua conexão ou configuração.';
});

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Definido mais tarde
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize_button').style.visibility = 'visible';
    }
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error(resp);
            return;
        }
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('upload-section').style.display = 'block';
        document.getElementById('signout_button').style.visibility = 'visible';
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('upload-section').style.display = 'none';
        document.getElementById('signout_button').style.visibility = 'hidden';
    }
}

let selectedFiles = []; // Armazena os arquivos selecionados

// Captura os arquivos selecionados pelo usuário
document.getElementById('file-input').addEventListener('change', (event) => {
    selectedFiles = Array.from(event.target.files);
    updateFileList();
});

// Atualiza a lista de arquivos exibida no frontend
function updateFileList() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = ''; // Limpa a lista atual

    if (selectedFiles.length === 0) {
        fileList.innerHTML = '<p class="empty-list-message" style="text-align: center; color: var(--gray-dark);">Nenhum arquivo selecionado</p>';
        document.getElementById('upload-button').disabled = true;
        return;
    }

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('p');
        fileItem.textContent = `${index + 1}. ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        fileList.appendChild(fileItem);
    });

    document.getElementById('upload-button').disabled = false; // Habilita o botão de upload
}

// Envia os arquivos selecionados para o Google Drive
document.getElementById('upload-button').addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        alert('Nenhum arquivo selecionado para upload.');
        return;
    }

    document.getElementById('upload-progress').style.display = 'block';
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const uploadedFilesList = document.getElementById('uploaded-files-list');
    uploadedFilesList.innerHTML = ''; // Limpa a lista de arquivos enviados

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
            const metadata = {
                name: file.name,
                mimeType: file.type,
            };

            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', file);

            // Configura o progresso do upload
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', true);
            xhr.setRequestHeader('Authorization', `Bearer ${gapi.client.getToken().access_token}`);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `${Math.round(progress)}%`;
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const result = JSON.parse(xhr.responseText);
                    console.log(`Arquivo enviado com sucesso: ${result.name} (ID: ${result.id})`);

                    // Adiciona o arquivo enviado à lista de arquivos enviados
                    const uploadedFileItem = document.createElement('li');
                    uploadedFileItem.innerHTML = `<a href="https://drive.google.com/file/d/${result.id}/view" target="_blank">${result.name}</a>`;
                    uploadedFilesList.appendChild(uploadedFileItem);
                } else {
                    console.error(`Erro ao enviar o arquivo ${file.name}:`, xhr.responseText);
                    alert(`Erro ao enviar o arquivo ${file.name}. Verifique o console para mais detalhes.`);
                }
            };

            xhr.onerror = () => {
                console.error(`Erro ao enviar o arquivo ${file.name}:`, xhr.responseText);
                alert(`Erro ao enviar o arquivo ${file.name}. Verifique o console para mais detalhes.`);
            };

            xhr.send(formData);
        } catch (error) {
            console.error(`Erro ao enviar o arquivo ${file.name}:`, error);
            alert(`Erro ao enviar o arquivo ${file.name}. Verifique o console para mais detalhes.`);
        }

        // Atualiza a barra de progresso geral (para múltiplos arquivos)
        const overallProgress = ((i + 1) / selectedFiles.length) * 100;
        progressBar.style.width = `${overallProgress}%`;
        progressText.textContent = `${Math.round(overallProgress)}%`;
    }

    alert('Upload concluído!');
    document.getElementById('upload-progress').style.display = 'none';
    selectedFiles = []; // Limpa os arquivos selecionados
    updateFileList(); // Atualiza a lista de arquivos
});

const dropZone = document.getElementById('drop-zone');

// Previne o comportamento padrão de "drag and drop"
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (event) => event.preventDefault());
    document.body.addEventListener(eventName, (event) => event.preventDefault());
});

// Adiciona estilos visuais ao arrastar arquivos para a área
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('highlight'));
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('highlight'));
});

// Lida com os arquivos soltos na área de upload
dropZone.addEventListener('drop', (event) => {
    const files = Array.from(event.dataTransfer.files);
    selectedFiles = selectedFiles.concat(files); // Adiciona os arquivos ao array existente
    updateFileList(); // Atualiza a lista de arquivos
});

