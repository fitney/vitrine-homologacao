/**
 * =================================================================================
 * ARQUIVO DE SCRIPT GLOBAL - VITRINE VIRTUAL (VERSÃO GITHUB PAGES)
 * =================================================================================
 */

/**
 * =================================================================================
 * 0. CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
 * =================================================================================
 */

// ⚠️ IMPORTANTE: Cole aqui a URL do seu Web App gerado no Google Apps Script!
const API_URL = "https://script.google.com/macros/s/AKfycbybDwNYEvF7cqex7PIB_ySynPz6l2JLP_ODVnnFKpcAp4IrRfrLo0do8mkzS-RVcsSoiQ/exec"; 

let bancoDeDados = []; 
let carrinho = []; 
let categoriaAtivaTopo = null; 

const CHAVE_CARRINHO = "cache_carrinho_v1"; 
const CHAVE_CACHE = "cache_vitrine_loja_full_v8"; 
const IMG_CONFIG = { 
  basePath: 'https://fitney.com.br/img',
  thumbsFolder: 'PRODUTOS_THUMBS',
  zoomFolder: 'PRODUTOS_ZOOM',
  extensao: '.webp' 
};

/**
 * =================================================================================
 * 1. UTILITÁRIOS E CONVERSORES
 * =================================================================================
 */

function verDetalhesProduto(sku) {
  // ATUALIZA O LINK (Substituído google.script.history pelo padrão HTML5)
  window.history.pushState({ view: 'pdp', id: sku }, "", "?p=" + sku);
}

function voltarParaHome(adicionarAoHistorico) {
  if (adicionarAoHistorico === undefined) {
    adicionarAoHistorico = true;
  }
  
  if (adicionarAoHistorico) {
    window.history.pushState({ view: 'home' }, "", window.location.pathname);
  }
  
  var banner = document.getElementById('banner-home');
  if (banner) {
    banner.classList.remove('d-none');
  }
  
  document.getElementById('view-produto').style.display = 'none';
  document.getElementById('view-lista').style.display = 'block';
  
  var sidebar = document.querySelector('.sidebar-filtros');
  if (sidebar && sidebar.parentElement) {
    sidebar.parentElement.style.display = 'block';
  }

  var colunaPrincipal = document.getElementById('view-lista').parentElement;
  if (colunaPrincipal) {
    colunaPrincipal.classList.remove('col-12'); 
    colunaPrincipal.classList.add('col-lg-9'); 
  }

  renderizarVitrine(bancoDeDados);
}

function v2n(valor) {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  var stringLimpa = String(valor).replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").trim();
  var numeroFinal = parseFloat(stringLimpa);
  if (isNaN(numeroFinal)) return 0;
  return numeroFinal;
}

function n2v(valor) {
  if (valor === undefined || valor === null || isNaN(valor)) return "0,00";
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function safeId(id) {
  return String(id).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function obterAtributosImagem(idProduto, urlDrive, ehZoom, idOtimizado) {
  if (!idOtimizado && !urlDrive) return `src="https://via.placeholder.com/400x500?text=Sem+Foto"`;
  var urlBackup = processarImg(urlDrive, ehZoom);
  if (idOtimizado) {
    var pastaRaiz = ehZoom ? IMG_CONFIG.zoomFolder : IMG_CONFIG.thumbsFolder;
    var pathReferencia = Array.isArray(idOtimizado) ? idOtimizado[0] : idOtimizado;
    var idLimpo = String(pathReferencia || "").trim();
    if (idLimpo.startsWith('/')) idLimpo = idLimpo.substring(1);
    if (!idLimpo || idLimpo === "null" || idLimpo === "undefined") return `src="${urlBackup}"`;
    var caminhoFinal = idLimpo.includes('.') ? idLimpo : idLimpo + IMG_CONFIG.extensao;
    var urlLocal = `${IMG_CONFIG.basePath}/${pastaRaiz}/${caminhoFinal}`;
    return `src="${urlLocal}" onerror="this.onerror=null; this.src='${urlBackup}';"`;
  }
  return `src="${urlBackup}"`;
}

function processarImg(url, altaQualidade) {
  if (!url || url.trim() === "") return 'https://via.placeholder.com/400x400?text=Sem+Foto';
  var match = url.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    var id = match[1];
    return altaQualidade ? "https://drive.google.com/thumbnail?id=" + id + "&sz=s4000" : "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000";
  }
  return url;
}

/**
 * =================================================================================
 * 2. INICIALIZAÇÃO E SINCRONIZAÇÃO
 * =================================================================================
 */

function esconderPreloader() {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    setTimeout(function() { preloader.style.display = 'none'; }, 500);
  }
}

function carregarDadosIniciais() {
  window.timerSeguranca = setTimeout(function() {
      const msgErro = document.getElementById('msg-timeout');
      const spinner = document.querySelector('.spinner-border');
      if (msgErro && spinner) {
          spinner.classList.add('d-none');
          msgErro.classList.remove('d-none');
      }
  }, 15000);

  var cacheLocal = localStorage.getItem(CHAVE_CACHE);
  
  if (cacheLocal) {
    console.log("⚡ [SISTEMA] Carregando dados do cache local...");
    try {
      bancoDeDados = JSON.parse(cacheLocal);
      if (Array.isArray(bancoDeDados) && bancoDeDados.length > 0) {
        inicializarInterface();
        esconderPreloader();
      }
    } catch (erro) {
      console.error("Erro ao ler cache:", erro);
      localStorage.removeItem(CHAVE_CACHE);
    }
  }

  // NOVA CHAMADA: API Fetch substituindo o google.script.run
  fetch(`${API_URL}?action=getDadosVitrine`)
    .then(response => response.text())
    .then(respostaTexto => {
      if (window.timerSeguranca) clearTimeout(window.timerSeguranca);
      try {
        var respostaObjeto = JSON.parse(respostaTexto);
        if (respostaObjeto.length > 0 && respostaObjeto[0].valorCusto === undefined) {
           console.log("🔒 [SEGURANÇA] Dados blindados recebidos (sem custo).");
        }
        processarRespostaServidor(respostaObjeto);
        esconderPreloader();
      } catch (e) {
        console.error("Erro ao converter os dados do servidor:", e);
        esconderPreloader(); 
      }
    })
    .catch(erro => {
      if (window.timerSeguranca) clearTimeout(window.timerSeguranca);
      esconderPreloader();
      tratarErroConexao(erro);
    });
}

function processarRespostaServidor(resposta) {
  if (resposta && resposta.erro) {
    console.error("Erro vindo do servidor:", resposta.erro);
    if (bancoDeDados.length === 0) {
      document.getElementById('vitrine').innerHTML = 
        '<div class="alert alert-danger text-center mt-5">Erro no sistema: ' + resposta.erro + '</div>';
    }
    return;
  }
  var novoJSON = JSON.stringify(resposta);
  var cacheAtual = localStorage.getItem(CHAVE_CACHE);

  if (novoJSON !== cacheAtual) {
    console.log("🔄 [SISTEMA] Novos dados detectados. Atualizando...");
    localStorage.setItem(CHAVE_CACHE, novoJSON);
    bancoDeDados = resposta;
    inicializarInterface();
  } else {
    console.log("✅ [SISTEMA] O banco de dados já está atualizado.");
  }
}

function tratarErroConexao(erro) {
  console.error("Falha grave de conexão:", erro);
  if (bancoDeDados.length === 0) {
    document.getElementById('vitrine').innerHTML = 
      '<div class="alert alert-warning text-center mt-5">Não foi possível conectar ao servidor. Verifique sua internet.</div>';
  }
}

function inicializarInterface() {
  popularFiltrosDinamicos();
  renderizarChipsCategorias();
  verificarRotaURL();

  var inputBusca = document.getElementById('input-busca-topo');
  if (inputBusca) {
    inputBusca.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var dropdown = document.getElementById('search-dropdown-floating');
        if (dropdown) dropdown.style.display = 'none';
        mostrarTodosResultadosBusca(this.value);
        this.blur();
      }
    });
  }
}

function verificarRotaURL() {
  var parametros = new URLSearchParams(window.location.search);
  var idProdutoURL = parametros.get('p');
  var banner = document.getElementById('banner-home');
  
  if (idProdutoURL) {
    if (banner) banner.classList.add('d-none');
    verProduto(idProdutoURL, false);
  } else {
    if (banner) banner.classList.remove('d-none');
    renderizarVitrine(bancoDeDados);
  }
}

// O restante das funções de RENDERIZAÇÃO DA VITRINE (3), FILTROS (4), ESTOQUE (5), CARRINHO (6) E ZOOM (7)
// permanecem exatamente iguais ao seu código original, pois não dependem do backend diretamente.
// Basta copiar do seu código antigo e colar aqui: renderizarVitrine, criarCardProduto, etc.
// ---------------------------------------------------------------------------------------------
// COPIE E COLE AQUI AS SESSÕES 3 A 7 DO SEU ARQUIVO ORIGINAL
// ---------------------------------------------------------------------------------------------


/**
 * =================================================================================
 * 8. IDENTIDADE VISUAL E CONFIGURAÇÃO (APPCONFIG)
 * =================================================================================
 */

const AppConfig = {
  data: {},
  init: function() {
    // NOVA CHAMADA: API Fetch substituindo google.script.run
    fetch(`${API_URL}?action=getConfigDAO`)
      .then(response => response.json())
      .then(res => {
        this.data = res; 
        this.applyToDOM();
      })
      .catch(err => console.warn("Configurações não encontradas ou erro no DAO.", err));
  },

  applyToDOM: function() {
    const c = this.data;
    if (!c || c.erro) return;

    const imgLogo = document.getElementById('logo-loja');
    if (imgLogo && c.LINK_LOGO) imgLogo.src = c.LINK_LOGO;

    const banner = document.getElementById('banner-home');
    if (banner && c.LINK_BANNER) {
        let urlFinal = c.LINK_BANNER.trim();
        let gradienteFinal; 
        const isMobileUI = window.matchMedia("(max-width: 800px)").matches;
        if (isMobileUI) {
            urlFinal = urlFinal.replace(/\.png$/i, '_mobile.png');
            gradienteFinal = `linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0) 90%)`;
        } else {
            gradienteFinal = `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.1) 100%)`;
        }
        banner.style.backgroundImage = `${gradienteFinal}, url('${urlFinal}')`;
    }

      const sobreEl = document.getElementById('footer-sobre');
      if (sobreEl) {
        sobreEl.innerText = c.SOBRE_NOS || "";
        sobreEl.style.textAlign = "justify";
        sobreEl.style.color = "#000";
      }

      const emailEl = document.getElementById('footer-email');
      if (emailEl) {
        emailEl.innerText = c.EMAIL || "";
        emailEl.style.color = "#000";
      }

      const instaBtn = document.getElementById('footer-insta');
      if (instaBtn) {
        instaBtn.style.display = c.LINK_INSTAGRAM ? 'inline-flex' : 'none';
        if (c.LINK_INSTAGRAM) {
          instaBtn.href = c.LINK_INSTAGRAM;
          instaBtn.style.color = "#000";
        }
      }

      if (c.WHATSAPP) {
        let foneRaw = String(c.WHATSAPP).replace(/\D/g, ''); 
        window.SEU_TELEFONE_LOJA = foneRaw.startsWith('55') ? foneRaw : '55' + foneRaw;
        let foneExibicao = foneRaw.startsWith('55') ? foneRaw.substring(2) : foneRaw;
        let foneFormatado = foneExibicao;

        if (foneExibicao.length === 11) {
          foneFormatado = `(${foneExibicao.substring(0,2)}) ${foneExibicao.substring(2,3)} ${foneExibicao.substring(3,7)}-${foneExibicao.substring(7)}`;
        } else if (foneExibicao.length === 10) {
          foneFormatado = `(${foneExibicao.substring(0,2)}) ${foneExibicao.substring(2,6)}-${foneExibicao.substring(6)}`;
        }

        const whatsappEl = document.getElementById('footer-whatsapp');
        if (whatsappEl) {
          whatsappEl.innerHTML = `
            <a href="https://wa.me/${window.SEU_TELEFONE_LOJA}" target="_blank" 
              class="text-decoration-none d-flex align-items-center gap-2 justify-content-center justify-content-md-end" 
              style="color: #000;">
              <i class="bi bi-whatsapp"></i> <span>${foneFormatado}</span>
            </a>`;
        }
      }
  }
};

/**
 * =================================================================================
 * 9. LISTENERS E EVENTOS GLOBAIS
 * =================================================================================
 */

window.addEventListener('resize', () => AppConfig.applyToDOM());

window.onpopstate = function(event) {
  if (event.state && event.state.view === 'pdp') {
    verProduto(event.state.id, false); 
  } else {
    voltarParaHome(false); 
  }
};

window.onload = function() {
  carregarDadosIniciais();     
  carregarCarrinhoDoCache();   
  AppConfig.init();            
};


/**
 * =================================================================================
 * 10 E 11. RENDERIZAÇÃO DA PÁGINA DE PRODUTO
 * =================================================================================
 */
function verProduto(id, adicionarAoHistorico) {
  if (adicionarAoHistorico === undefined) adicionarAoHistorico = true;

  var p = bancoDeDados.find(x => String(x.id) === String(id));
  if (!p) { console.warn("Produto não encontrado no banco local:", id); return; }

  // ATUALIZAÇÃO NO ROTEAMENTO HTML5
  if (adicionarAoHistorico) {
    window.history.pushState({ view: 'pdp', id: id }, "", "?p=" + id);
  }

  var banner = document.getElementById('banner-home');
  if (banner) banner.classList.add('d-none');

  document.getElementById('view-lista').style.display = 'none';
  
  var sidebar = document.querySelector('.sidebar-filtros');
  if (sidebar && sidebar.parentElement) sidebar.parentElement.style.display = 'none';
  
  var colunaPrincipal = document.getElementById('view-lista').parentElement;
  if (colunaPrincipal) {
    colunaPrincipal.classList.remove('col-lg-9'); 
    colunaPrincipal.classList.add('col-12'); 
  }

  var viewProduto = document.getElementById('view-produto');
  viewProduto.style.display = 'block';
  viewProduto.innerHTML = `
    <div class="container" style="max-width: 960px; margin: 0 auto;">
      <div id="pdp-wrapper" class="row g-4 mt-2"></div>
    </div>
  `;
  
  renderizarDetalhesProduto(p);

  setTimeout(function() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, 50);
}

// COLE AQUI A FUNÇÃO renderizarDetalhesProduto(p) e renderizarChipsCategorias() ORIGINAIS
// ...

// =================================================================================
// ENVIO DOS DADOS DO MODAL DE AVISO (LEADS)
// =================================================================================

function enviarAvisoLead() {
    const sku = document.getElementById('aviso-sku').value;
    const nomeProd = document.getElementById('aviso-nome-prod').value;
    const tamanho = document.getElementById('aviso-tamanho').value;
    const nome = document.getElementById('aviso-nome').value.trim();
    const whatsapp = document.getElementById('aviso-whatsapp').value.trim();

    if (!tamanho) return mostrarAvisoFlutuante("⚠️ Selecione o tamanho desejado.", "warning");
    if (!nome) return mostrarAvisoFlutuante("⚠️ Informe seu nome.", "warning");
    if (!whatsapp || whatsapp.length < 14) return mostrarAvisoFlutuante("⚠️ Informe um WhatsApp válido com DDD.", "warning");

    const btn = document.getElementById('btn-salvar-aviso');
    const txtOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> ENVIANDO...';

    const payload = {
        sku: sku,
        nome: nomeProd,
        tamanho: tamanho,
        nomeCliente: nome,
        whatsapp: whatsapp
    };

    // NOVA CHAMADA: API Fetch via POST substituindo google.script.run
    fetch(`${API_URL}?action=salvarAvisoProduto`, {
        method: 'POST',
        // O corpo vai como texto (JSON em string) para evitar conflitos de CORS no Apps Script
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(res => {
        mostrarAvisoFlutuante("✅ Tudo certo! Avisaremos assim que o estoque for reposto.", "success");
        const m = bootstrap.Modal.getInstance(document.getElementById('modalAvisoEstoque'));
        if (m) m.hide(); 
        btn.disabled = false;
        btn.innerHTML = txtOriginal;
    })
    .catch(err => {
        mostrarAvisoFlutuante("❌ Erro ao enviar solicitação. Tente novamente.", "danger");
        btn.disabled = false;
        btn.innerHTML = txtOriginal;
    });
}

function mostrarAvisoFlutuante(mensagem, cor = 'success') {
  let container = document.getElementById('toast-container-global');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container-global';
    container.className = 'position-fixed top-0 end-0 p-4';
    container.style.zIndex = '10600'; 
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `alert alert-${cor} shadow-lg d-flex align-items-center alert-dismissible fade show`;
  toast.style.minWidth = '300px';
  toast.innerHTML = `
    <strong class="me-auto">${mensagem}</strong>
    <button type="button" class="btn-close ms-3" data-bs-dismiss="alert"></button>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 150);
  }, 3000);
}