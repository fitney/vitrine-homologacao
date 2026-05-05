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

/**
 * =================================================================================
 * 3. RENDERIZAÇÃO DA VITRINE
 * =================================================================================
 */

function renderizarVitrine(listaProdutos) {
  var containerVitrine = document.getElementById('vitrine');
  var viewLista = document.getElementById('view-lista');
  
  if (!containerVitrine) return;
  if (viewLista) viewLista.style.display = 'block';

  var produtosValidos = listaProdutos.filter(function(p) {
    var precoVenda = v2n(p.valorVenda);
    var precoPromo = v2n(p.valorPromo);
    return precoVenda > 0 || precoPromo > 0;
  });

  produtosValidos.sort(function(a, b) {
    if (a.isDestaque !== b.isDestaque) return a.isDestaque ? -1 : 1;
    return (b.dataCadastro || 0) - (a.dataCadastro || 0);
  });

  if (produtosValidos.length === 0) {
    containerVitrine.innerHTML = 
      '<div class="col-12 text-center py-5">' +
        '<i class="bi bi-search text-muted d-block mb-3" style="font-size: 3rem;"></i>' +
        '<h4 class="text-muted">Nenhum produto encontrado.</h4>' +
        '<p class="text-secondary small">Tente limpar os filtros para ver mais opções.</p>' +
      '</div>';
    return;
  }

  var htmlFinal = produtosValidos.map(function(p) { return criarCardProduto(p); }).join('');
  containerVitrine.innerHTML = htmlFinal;
}

function criarCardProduto(p) {
  var nVenda = v2n(p.valorVenda);
  var nPromo = v2n(p.valorPromo);
  var nPix = v2n(p.valorPix);
  var estaEmPromo = p.isPromoAtiva !== undefined ? p.isPromoAtiva : nPromo > 0;
  var precoPrincipal = estaEmPromo ? nPromo : nVenda;
  var isEsgotado = p.estoque <= 0;
  
  var fotoOriginal = (Array.isArray(p.todasFotos) && p.todasFotos.length > 0) ? p.todasFotos[0] : null;

  var variacoes = Array.isArray(p.variacoes) ? p.variacoes : [];
  var tamanhosDisponiveis = [];
  variacoes.forEach(function(v) {
    if (v.quantidade > 0 && !tamanhosDisponiveis.includes(v.tamanho)) tamanhosDisponiveis.push(v.tamanho);
  });

  var htmlTamanhos = "";
  if (!isEsgotado && tamanhosDisponiveis.length > 0) {
    htmlTamanhos = tamanhosDisponiveis.slice(0, 4).map(function(t) {
      return '<span class="badge bg-white text-secondary border fw-normal me-1" style="font-size: 0.6rem;">' + t + '</span>';
    }).join('');
    if (tamanhosDisponiveis.length > 4) {
      htmlTamanhos += '<span class="badge bg-light text-muted border fw-normal" style="font-size: 0.6rem;">+</span>';
    }
  } else {
    htmlTamanhos = '<span class="badge bg-danger text-white border fw-bold px-2 py-1" style="font-size: 0.6rem; letter-spacing: 1px;">ESGOTADO</span>';
  }

  var htmlOferta = estaEmPromo 
    ? `<div class="position-absolute top-0 end-0 m-2 bg-danger text-white px-2 py-1 shadow rounded-pill fw-bold d-flex align-items-center justify-content-center" 
            style="width: fit-content !important; height: auto !important; font-size: 0.65rem; z-index: 10;">
         <i class="bi bi-tag-fill me-1"></i> OFERTA
       </div>` 
    : '';

  var htmlPrecoAntigo = estaEmPromo ? '<small class="text-decoration-line-through text-muted d-block" style="font-size: 0.7rem">De: ' + n2v(nVenda) + '</small>' : '';
  var htmlPix = p.isPixAtivo ? `<div class="text-success fw-bold mt-1" style="font-size: 0.7rem;"><i class="bi bi-lightning-charge-fill"></i> ou ${n2v(nPix)} via PIX</div>` : '';

  return `
    <div class="col-6 col-md-4 col-lg-3 mb-4">
      <div class="card card-produto h-100 border-0 shadow-sm" onclick="verProduto('${safeId(p.id)}')" style="cursor:pointer; overflow: hidden; ${isEsgotado ? 'opacity: 0.8;' : ''}">
        <div class="position-relative ratio bg-white rounded-top border-bottom" style="--bs-aspect-ratio: 125%;">
          <img ${obterAtributosImagem(p.id, fotoOriginal, false, p.idOtimizado)} 
            class="card-img-top object-fit-cover" loading="lazy" alt="${p.nome}" referrerpolicy="no-referrer">
          ${htmlOferta}
        </div>
        <div class="card-body p-2 d-flex flex-column">
          <div class="mb-1">
            <small class="text-uppercase text-primary fw-bold" style="font-size: 0.65rem;">${p.categoria || 'Geral'}</small>
            <h6 class="fw-bold mb-0 text-truncate text-dark" title="${p.nome}" style="font-size: 0.9rem;">${p.nome || 'Produto'}</h6>
          </div>
          ${!isEsgotado ? `
          <div class="price-info mb-2">
            ${htmlPrecoAntigo}
            <span class="fw-bold text-primary" style="font-size: 1rem;">${estaEmPromo ? 'Por: ' : ''}${n2v(precoPrincipal)}</span>
            ${htmlPix}
          </div>` : ''}
          <div class="mt-auto border-top pt-2">
            <div class="d-flex flex-wrap" style="max-height: 22px; overflow: hidden;">${htmlTamanhos}</div>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * =================================================================================
 * 4. SISTEMA DE FILTROS E BUSCA
 * =================================================================================
 */

function getSelecionados(tipo) {
  var inputs = document.querySelectorAll(`.filter-check[data-type="${tipo}"]:checked`);
  return Array.from(inputs).map(el => String(el.value).trim().toUpperCase());
}

function popularFiltrosDinamicos() {
  if (!bancoDeDados || bancoDeDados.length === 0) return;

  var validos = bancoDeDados.filter(function(p) {
    var temPreco = v2n(p.valorVenda) > 0 || v2n(p.valorPromo) > 0;
    var estoqueTotal = (Array.isArray(p.variacoes) ? p.variacoes : []).reduce((acc, v) => acc + (Number(v.quantidade) || 0), 0);
    return temPreco && estoqueTotal > 0;
  });
  
  var categorias = [...new Set(validos.map(p => p.categoria))].filter(Boolean).sort();
  var subcategorias = [...new Set(validos.map(p => p.subcategoria))].filter(Boolean).sort();
  var todasVariacoes = validos.flatMap(p => Array.isArray(p.variacoes) ? p.variacoes : []);
  var variacoesComEstoque = todasVariacoes.filter(v => v.quantidade > 0);
  var cores = [...new Set(variacoesComEstoque.map(v => v.cor))].filter(Boolean).sort();
  var tamanhos = [...new Set(variacoesComEstoque.map(v => v.tamanho))].filter(Boolean);

  var pesoTamanho = { 'PP':1, 'P':2, 'M':3, 'G':4, 'GG':5, 'XG':6, 'G1':7, 'G2':8, 'G3':9, 'UNICO':10 };
  tamanhos.sort((a, b) => (pesoTamanho[String(a).toUpperCase()]||99) - (pesoTamanho[String(b).toUpperCase()]||99));

  renderizarCheckboxes('list-categoria', categorias, 'cat');
  renderizarCheckboxes('list-subcategoria', subcategorias, 'sub');
  renderizarCheckboxes('list-cor', cores, 'cor');
  renderizarCheckboxes('list-tamanho', tamanhos, 'tam');
}

function renderizarCheckboxes(containerId, lista, tipo) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var secaoPai = container.closest('.filter-section');
  if (lista.length === 0) { if (secaoPai) secaoPai.style.display = 'none'; return; }
  if (secaoPai) secaoPai.style.display = 'block';

  container.innerHTML = lista.map((item, index) => `
    <div class="checkbox-filter d-flex align-items-center mb-1">
      <input type="checkbox" id="${tipo}-${index}" value="${item}" class="filter-check me-2" data-type="${tipo}" onchange="aplicarFiltros()">
      <label for="${tipo}-${index}" class="text-truncate small" style="cursor:pointer; flex:1" title="${item}">${item}</label>
    </div>`).join('');
}

function validarProduto(p, fCat, fSub, fCor, fTam) {
    if (v2n(p.valorVenda) <= 0 && v2n(p.valorPromo) <= 0) return false;
    var estoqueTotal = (Array.isArray(p.variacoes) ? p.variacoes : []).reduce((acc, v) => acc + (Number(v.quantidade) || 0), 0);
    if (estoqueTotal <= 0) return false;

    var pCat = String(p.categoria || "").trim().toUpperCase();
    var pSub = String(p.subcategoria || "").trim().toUpperCase();
    var vars = Array.isArray(p.variacoes) ? p.variacoes : [];

    var okCat = (fCat.length === 0 || fCat.includes(pCat));
    var okSub = (fSub.length === 0 || fSub.includes(pSub));
    var okCor = (fCor.length === 0 || vars.some(v => fCor.includes(String(v.cor||"").trim().toUpperCase()) && v.quantidade > 0));
    var okTam = (fTam.length === 0 || vars.some(v => fTam.includes(String(v.tamanho||"").trim().toUpperCase()) && v.quantidade > 0));

    return okCat && okSub && okCor && okTam;
}

function atualizarDisponibilidadeFiltros(selCat, selSub, selCor, selTam) {
  const baseReduzida = bancoDeDados.filter(p => {
    const temPreco = v2n(p.valorVenda) > 0 || v2n(p.valorPromo) > 0;
    const estoqueTotal = (p.variacoes || []).reduce((acc, v) => acc + (Number(v.quantidade) || 0), 0);
    return temPreco && estoqueTotal > 0;
  });

  const checkboxes = document.querySelectorAll('.filter-check');
  window.requestAnimationFrame(() => {
    checkboxes.forEach(function(chk) {
      const tipo = chk.dataset.type;
      const valor = String(chk.value).trim().toUpperCase();

      if (chk.checked) {
        const divPai = chk.closest('.checkbox-filter');
        if (divPai) { divPai.style.display = 'flex'; divPai.classList.remove('d-none'); }
        return;
      }

      const testeCat = (tipo === 'cat') ? [valor] : selCat;
      const testeSub = (tipo === 'sub') ? [valor] : selSub;
      const testeCor = (tipo === 'cor') ? [valor] : selCor;
      const testeTam = (tipo === 'tam') ? [valor] : selTam;

      const existeProduto = baseReduzida.some(p => validarProduto(p, testeCat, testeSub, testeCor, testeTam));

      const divPai = chk.closest('.checkbox-filter');
      if (divPai) {
        if (existeProduto) {
          divPai.style.display = 'flex'; divPai.classList.remove('d-none');
        } else {
          divPai.style.display = 'none'; divPai.classList.add('d-none');
        }
      }
    });
  });
}

function limparTodosFiltros() {
  var checkboxes = document.querySelectorAll('.filter-check');
  checkboxes.forEach(function(el) { el.checked = false; });
  renderizarVitrine(bancoDeDados);
  document.querySelectorAll('.checkbox-filter').forEach(function(el) { el.style.display = 'flex'; });
}

function realizarBuscaTopo(termo) {
  var t = termo.trim().toUpperCase();
  var input = document.getElementById('input-busca-topo');
  var searchContainer = input.closest('.flex-grow-1'); 
  searchContainer.style.position = 'relative';

  let dropdown = document.getElementById('search-dropdown-floating');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'search-dropdown-floating';
    dropdown.style.cssText = `
      position: absolute; top: calc(100% + 5px); left: 0; width: 100%;
      background: #ffffff; z-index: 1050; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      display: none; flex-direction: column; border: 1px solid #e9ecef; overflow: hidden;
    `;
    searchContainer.appendChild(dropdown);
    document.addEventListener('click', function(e) {
      if (!searchContainer.contains(e.target)) dropdown.style.display = 'none';
    });
  }

  if (t === "") {
    dropdown.style.display = 'none';
    resetarFiltrosTopo();
    return;
  }

  categoriaAtivaTopo = null;
  var containerCats = document.getElementById('container-chips-categorias');
  if (containerCats) {
     var botoes = containerCats.getElementsByTagName('button');
     for(var i=0; i < botoes.length; i++) botoes[i].className = "btn btn-sm btn-chip-cat rounded-pill px-3 text-uppercase text-nowrap flex-shrink-0 transition-all";
  }

  var resultados = bancoDeDados.filter(function(p) {
    if (v2n(p.valorVenda) <= 0 && v2n(p.valorPromo) <= 0) return false;
    if (p.estoque <= 0) {
       const hoje = new Date().getTime();
       const diferencaEmDias = (hoje - p.dataUltimaVenda) / (1000 * 3600 * 24);
       if (diferencaEmDias > 20) return false;
    }
    var matchNome = p.nome.toUpperCase().includes(t);
    var matchId   = String(p.id).includes(t);
    var matchSku  = String(p.sku || "").toUpperCase().includes(t);
    var matchTags = String(p.tagsBusca || "").toUpperCase().includes(t);
    return matchNome || matchId || matchSku || matchTags;
  });

  if (resultados.length > 0) {
     var sugestoesHtml = resultados.slice(0, 3).map(p => {
         var nomeDestacado = p.nome.replace(new RegExp(t, 'gi'), match => `<strong class="text-dark">${match}</strong>`);
         return `<a href="javascript:void(0)" onclick="document.getElementById('search-dropdown-floating').style.display='none'; verProduto('${safeId(p.id)}');" class="text-decoration-none d-flex align-items-center p-3 border-bottom text-muted" style="transition: 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
           <i class="bi bi-search me-3"></i>
           <span class="text-lowercase" style="font-size: 0.95rem;">${nomeDestacado}</span>
         </a>`;
     }).join('');

     var produtosComEstoque = resultados.filter(p => p.estoque > 0);
     var produtosHtml = produtosComEstoque.slice(0, 3).map(p => {
         let fotoOriginal = (Array.isArray(p.todasFotos) && p.todasFotos.length > 0) ? p.todasFotos[0] : null;
         let idOtimizadoUnico = (Array.isArray(p.idOtimizado) && p.idOtimizado.length > 0) ? p.idOtimizado[0] : null;
         let atributosImg = obterAtributosImagem(p.id, fotoOriginal, false, idOtimizadoUnico);
         var preco = p.isPromoAtiva ? p.valorPromo : p.valorVenda;
         return `<a href="javascript:void(0)" onclick="document.getElementById('search-dropdown-floating').style.display='none'; verProduto('${safeId(p.id)}');" class="text-decoration-none d-flex align-items-center p-3 border-bottom" style="transition: 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
           <div style="min-width: 60px; min-height: 60px; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: #fff;" class="shadow-sm border me-3">
             <img ${atributosImg} style="width: 100%; height: 100%; object-fit: cover;">
           </div>
           <div class="flex-grow-1 overflow-hidden">
             <h6 class="text-dark fw-bold mb-1 text-truncate" style="font-size: 0.85rem;">${p.nome}</h6>
             <div class="d-flex align-items-center gap-2">
               <span class="fw-bold text-dark" style="font-size: 1rem;">${n2v(preco)}</span>
             </div>
           </div>
         </a>`;
     }).join('');

     dropdown.innerHTML = `
        <div class="d-flex flex-column w-100">
          <div class="bg-light px-3 py-2 border-bottom">
             <span class="text-muted fw-bold text-uppercase" style="font-size: 0.65rem; letter-spacing: 1px;">Sugestões</span>
          </div>
          <div class="d-flex flex-column m-0 p-0">${sugestoesHtml}</div>
          ${produtosHtml ? `
          <div class="bg-light px-3 py-2 border-bottom border-top">
             <span class="text-muted fw-bold text-uppercase" style="font-size: 0.65rem; letter-spacing: 1px;">Produtos Sugeridos</span>
          </div>
          <div class="d-flex flex-column m-0 p-0">${produtosHtml}</div>
          ` : ''}
          <div class="p-3 bg-white text-center">
             <button class="btn btn-dark btn-sm rounded-pill px-4 fw-bold w-100" onclick="document.getElementById('search-dropdown-floating').style.display='none'; mostrarTodosResultadosBusca('${t}');">
                VER TODOS OS ${resultados.length} RESULTADOS
             </button>
          </div>
        </div>
     `;
     dropdown.style.display = 'flex';
  } else {
     dropdown.innerHTML = `
        <div class="p-4 text-center text-muted">
           <i class="bi bi-emoji-frown fs-1 d-block mb-2 opacity-50"></i>
           <h6 class="fw-bold mb-1">Poxa, não encontramos nada</h6>
           <small style="font-size: 0.8rem;">Tente buscar por outras palavras.</small>
        </div>
     `;
     dropdown.style.display = 'flex';
  }
}

function mostrarTodosResultadosBusca(termo) {
  voltarParaHome(false); 
  var t = termo.trim().toUpperCase();
  var resultados = bancoDeDados.filter(function(p) {
     if (v2n(p.valorVenda) <= 0 && v2n(p.valorPromo) <= 0) return false;
     var matchNome = p.nome.toUpperCase().includes(t);
     var matchId   = String(p.id).includes(t);
     var matchSku  = String(p.sku || "").toUpperCase().includes(t);
     var matchTags = String(p.tagsBusca || "").toUpperCase().includes(t);
     return matchNome || matchId || matchSku || matchTags;
  });
  renderizarVitrine(resultados);
  var banner = document.getElementById('banner-home');
  if (banner) banner.classList.add('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filtrarPorCategoriaTopo(categoria, btnElement) {
  const viewProduto = document.getElementById('view-produto');
  if (viewProduto && viewProduto.style.display === 'block') {
    voltarParaHome(false); 
  }
  document.getElementById('input-busca-topo').value = "";
  
  if (categoriaAtivaTopo === categoria) {
      resetarFiltrosTopo();
      return;
  }
  categoriaAtivaTopo = categoria;
  const container = document.getElementById('container-chips-categorias');
  if (container) {
      const todosBotoes = container.getElementsByTagName('button');
      for(let i = 0; i < todosBotoes.length; i++) {
          todosBotoes[i].className = "btn btn-sm btn-chip-cat rounded-pill px-3 text-uppercase text-nowrap flex-shrink-0 transition-all";
      }
  }
  btnElement.className = "btn btn-sm btn-dark rounded-pill px-3 fw-bold text-uppercase text-nowrap flex-shrink-0 transition-all";
  document.querySelectorAll('.filter-check').forEach(chk => chk.checked = false);
  
  const inputs = document.querySelectorAll(`.filter-check[data-type="cat"]`);
  for (let i = 0; i < inputs.length; i++) {
     if (inputs[i].value.toUpperCase() === categoria.toUpperCase()) {
         inputs[i].checked = true;
         break;
     }
  }
  aplicarFiltros();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetarFiltrosTopo() {
  categoriaAtivaTopo = null;
  document.getElementById('input-busca-topo').value = "";
  var container = document.getElementById('container-chips-categorias');
  if (container) {
      var todosBotoes = container.getElementsByTagName('button');
      for(var i=0; i < todosBotoes.length; i++) {
          todosBotoes[i].className = "btn btn-sm btn-chip-cat rounded-pill px-3 text-uppercase text-nowrap flex-shrink-0 transition-all";
      }
  }
  limparTodosFiltros();
}

function focarBusca() {
    document.getElementById('input-busca-topo').focus();
}

function aplicarFiltros() {
  var selCat = getSelecionados('cat');
  var selSub = getSelecionados('sub');
  var selCor = getSelecionados('cor');
  var selTam = getSelecionados('tam');

  var produtosParaVitrine = bancoDeDados.filter(function(p) {
     return validarProduto(p, selCat, selSub, selCor, selTam);
  });

  renderizarVitrine(produtosParaVitrine);
  atualizarDisponibilidadeFiltros(selCat, selSub, selCor, selTam);
}

/**
 * =================================================================================
 * 5. SELEÇÃO DE VARIAÇÕES E ESTOQUE
 * =================================================================================
 */

function gerarHTMLTamanhos(p) {
  var tamanhosUnicos = [...new Set((p.variacoes || []).map(v => v.tamanho))];
  var pesoTamanho = { 'PP':1, 'P':2, 'M':3, 'G':4, 'GG':5, 'XG':6, 'G1':7, 'G2':8, 'G3':9, 'UNICO':10 };
  tamanhosUnicos.sort((a, b) => (pesoTamanho[String(a).toUpperCase()]||99) - (pesoTamanho[String(b).toUpperCase()]||99));

  return tamanhosUnicos.map(function(tam) {
    var temEstoque = p.variacoes.some(v => v.tamanho === tam && v.quantidade > 0);
    var idUnico = 'tam-init-' + p.id + '-' + tam.replace(/\s+/g,'');
    var opacityStyle = !temEstoque ? 'opacity: 0.5;' : '';

    return `
      <input type="radio" class="btn-check" name="grupo-tam-init-${p.id}" id="${idUnico}" 
             onchange="atualizarCoresDisponiveis('${safeId(p.id)}', '${safeId(tam)}')">
      <label class="btn btn-outline-dark btn-sm px-3 py-2" for="${idUnico}" style="${opacityStyle}">
        ${tam}
      </label>`;
  }).join('');
}

function atualizarCoresDisponiveis(idProduto, tamanhoSelecionado) {
  var p = bancoDeDados.find(x => String(x.id) === String(idProduto));
  var container = document.getElementById('container-cores-' + idProduto);
  
  var variacoesFiltradas = p.variacoes.filter(v => v.tamanho === tamanhoSelecionado);
  var estoqueTamanho = variacoesFiltradas.reduce((acc, v) => acc + (Number(v.quantidade) || 0), 0);

  if (estoqueTamanho <= 0) {
    container.innerHTML = '<span class="text-danger small fw-bold mt-1"><i class="bi bi-x-circle"></i> Esgotado em todas as cores.</span>';
    
    const divEstoque = document.getElementById('container-estoque-' + idProduto);
    const btn = document.getElementById('btn-whatsapp-' + idProduto);

    divEstoque.innerHTML = `
      <div class="alert alert-secondary py-2 small border-0 bg-secondary-subtle text-secondary-emphasis d-flex align-items-center">
        <i class="bi bi-exclamation-triangle-fill me-2"></i> 
        <span>Tamanho ${tamanhoSelecionado} esgotado no momento.</span>
      </div>`;

    btn.innerHTML = `<i class="bi bi-bell-fill text-warning me-2"></i> AVISE-ME QUANDO CHEGAR`;
    btn.className = "btn btn-dark w-100 py-3 mt-3 rounded shadow-sm fw-bold animate__animated animate__pulse"; 
    btn.style.opacity = "1";
    btn.style.backgroundColor = ""; 
    btn.style.borderColor = "";     
    btn.style.color = "";           
    btn.style.cursor = "pointer";
    
    btn.onclick = function(e) {
      e.preventDefault();
      abrirModalAviso(idProduto, tamanhoSelecionado);
    }; 
    
    btn.style.display = 'block';
    return; 
  }

  container.innerHTML = variacoesFiltradas.map(function(v) {
    var semEstoque = v.quantidade <= 0;
    var idUnico = 'cor-' + idProduto + '-' + v.cor.replace(/\s+/g,'');
    var opacityStyle = semEstoque ? 'opacity: 0.5;' : '';
    
    return `
      <input type="radio" class="btn-check" name="grupo-cor-${idProduto}" id="${idUnico}" 
             onchange="selecionarVariacaoFinal('${safeId(idProduto)}', '${safeId(v.cor)}', '${safeId(tamanhoSelecionado)}', ${v.quantidade}, '${v.idCor}', '${v.idTam}')">
      <label class="btn btn-outline-secondary btn-sm px-3 py-2" for="${idUnico}" style="${opacityStyle}">
        ${v.cor}
      </label>`;
  }).join('');
  
  document.getElementById('container-estoque-' + idProduto).innerHTML = '';
  document.getElementById('btn-whatsapp-' + idProduto).style.display = 'none';
}

function selecionarVariacaoFinal(idProduto, cor, tam, qtdTotalEstoque, idCor, idTam) {
  const p = bancoDeDados.find(x => String(x.id) === String(idProduto));
  const divEstoque = document.getElementById('container-estoque-' + idProduto);
  const btn = document.getElementById('btn-whatsapp-' + idProduto);

  const itemNoCarrinho = carrinho.find(item => 
      item.id === idProduto && item.cor === cor && item.tamanho === tam
  );
  const qtdNoCarrinho = itemNoCarrinho ? itemNoCarrinho.qtd : 0;
  const disponivelReal = qtdTotalEstoque - qtdNoCarrinho;

  if (disponivelReal <= 0) {
    divEstoque.innerHTML = `
      <div class="alert alert-secondary py-2 small border-0 bg-secondary-subtle text-secondary-emphasis d-flex align-items-center">
        <i class="bi bi-exclamation-triangle-fill me-2"></i> 
        <span>Variação esgotada no momento.</span>
      </div>`;

    btn.innerHTML = `<i class="bi bi-bell-fill text-warning me-2"></i> AVISE-ME QUANDO CHEGAR`;
    btn.className = "btn btn-dark w-100 py-3 mt-3 rounded shadow-sm fw-bold animate__animated animate__pulse"; 
    btn.style.opacity = "1";
    btn.style.backgroundColor = ""; 
    btn.style.borderColor = "";     
    btn.style.color = "";           
    btn.style.cursor = "pointer";
    
    btn.onclick = function(e) {
      e.preventDefault();
      abrirModalAviso(idProduto, tam);
    }; 
    
  } else {
    divEstoque.innerHTML = `
      <div class="alert alert-success py-2 small border-0 bg-success-subtle text-success-emphasis d-flex align-items-center">
        <i class="bi bi-check-circle-fill me-2"></i> 
        <span>Disponível: <strong>${disponivelReal} unidades</strong></span>
      </div>`;

    btn.innerHTML = `<i class="bi bi-cart-plus me-2"></i> ADICIONAR AO CARRINHO`;
    btn.className = "btn w-100 py-3 mt-3 rounded shadow-sm fw-bold animate__animated animate__fadeInUp";
    btn.style.opacity = "1";
    btn.style.backgroundColor = "#FF4F95"; 
    btn.style.borderColor = "#FF4F95";     
    btn.style.color = "#FFFFFF";           
    btn.style.cursor = "pointer";
    
    btn.onclick = function(e) {
      e.preventDefault();
      const precoParaCarrinho = v2n(p.valorPromo) > 0 ? p.valorPromo : p.valorVenda;
      const fotoParaCarrinho = (p.todasFotos && p.todasFotos.length > 0) ? processarImg(p.todasFotos[0], false) : "";
      adicionarAoCarrinho(p.id, p.nome, precoParaCarrinho, cor, tam, fotoParaCarrinho, idCor, idTam);
      selecionarVariacaoFinal(idProduto, cor, tam, qtdTotalEstoque, idCor, idTam);
    };
  }
  btn.style.display = 'block';
}

function abrirModalAviso(idProduto, tamanhoPreSelecionado = null) {
    if (window.bloqueioModalAviso) return;
    window.bloqueioModalAviso = true;
    setTimeout(() => { window.bloqueioModalAviso = false; }, 1000);

    var p = bancoDeDados.find(x => String(x.id) === String(idProduto));
    if (!p) return mostrarAvisoFlutuante("❌ Erro: Produto não encontrado.", "danger");

    var todosTamanhosBD = [...new Set(bancoDeDados.flatMap(prod => (prod.variacoes || []).map(v => v.tamanho)))].filter(Boolean);
    var pesoTamanho = { 'PP':1, 'P':2, 'M':3, 'G':4, 'GG':5, 'XG':6, 'G1':7, 'G2':8, 'G3':9, 'UNICO':10 };
    todosTamanhosBD.sort((a, b) => (pesoTamanho[String(a).toUpperCase()]||99) - (pesoTamanho[String(b).toUpperCase()]||99));
    
    if (todosTamanhosBD.length === 0) todosTamanhosBD = ["ÚNICO"]; 

    var opcoesTamanho = todosTamanhosBD.map(t => {
        var isSelected = (tamanhoPreSelecionado && String(t).toUpperCase() === String(tamanhoPreSelecionado).toUpperCase()) ? "selected" : "";
        return `<option value="${t}" ${isSelected}>${t}</option>`;
    }).join('');

    var modalAntigo = document.getElementById('modalAvisoEstoque');
    if (modalAntigo) modalAntigo.remove();

    var modalContainer = document.createElement('div');
    modalContainer.className = "modal fade";
    modalContainer.id = "modalAvisoEstoque";
    modalContainer.setAttribute("tabindex", "-1");
    
    modalContainer.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden w-100">
          <div class="modal-header bg-dark text-white p-4 border-0">
            <h5 class="modal-title fw-bold mb-0 d-flex align-items-center" style="font-size: 1rem;">
              <div class="bg-white bg-opacity-25 rounded p-2 me-3 d-inline-flex"><i class="bi bi-bell-fill text-warning"></i></div>
              AVISE-ME QUANDO CHEGAR
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4 bg-light">
            <p class="text-muted small mb-4">Deixe seus dados abaixo e avisaremos via WhatsApp assim que o produto <strong class="text-dark">${p.nome}</strong> for reposto.</p>
            <input type="hidden" id="aviso-sku" value="${p.sku || p.id}">
            <input type="hidden" id="aviso-nome-prod" value="${p.nome}">
            <div class="form-floating mb-3 shadow-sm">
              <select class="form-select border-0 fw-bold text-dark" id="aviso-tamanho">
                <option value="">Selecione...</option>
                ${opcoesTamanho}
              </select>
              <label class="text-muted fw-bold small text-uppercase">Tamanho Desejado</label>
            </div>
            <div class="form-floating mb-3 shadow-sm">
              <input type="text" class="form-control border-0 fw-bold text-dark" id="aviso-nome" placeholder="Seu nome">
              <label class="text-muted fw-bold small text-uppercase">Seu Nome</label>
            </div>
            <div class="form-floating mb-2 shadow-sm">
              <input type="tel" class="form-control border-0 fw-bold text-dark" id="aviso-whatsapp" placeholder="WhatsApp" 
                     oninput="this.value = this.value.replace(/\\D/g, '').replace(/^(\\d{2})(\\d)/g, '($1) $2').replace(/(\\d)(\\d{4})$/, '$1-$2').substring(0, 15);">
              <label class="text-muted fw-bold small text-uppercase">WhatsApp (DDD + Número)</label>
            </div>
          </div>
          <div class="modal-footer bg-white border-top p-3 d-flex justify-content-between rounded-bottom-4">
            <button type="button" class="btn btn-light fw-bold border px-4" data-bs-dismiss="modal">CANCELAR</button>
            <button type="button" class="btn btn-dark fw-bold px-4 shadow-sm rounded-pill" id="btn-salvar-aviso" onclick="enviarAvisoLead()">
              <i class="bi bi-send-fill me-2"></i> ENVIAR SOLICITAÇÃO
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalContainer);
    var modalInstance = new bootstrap.Modal(modalContainer);
    modalInstance.show();
}

/**
 * =================================================================================
 * 6. GESTÃO DO CARRINHO E PEDIDOS
 * =================================================================================
 */

function adicionarAoCarrinho(id, nome, preco, cor, tamanho, foto, idCor, idTam) {
    const produtoOriginal = bancoDeDados.find(p => String(p.id) === String(id));
    const variacaoOficial = produtoOriginal?.variacoes?.find(v => v.cor === cor && v.tamanho === tamanho);
    const estoqueDisponivel = variacaoOficial ? Number(variacaoOficial.quantidade) : 0;

    const itemNoCarrinho = carrinho.find(item => item.id === id && item.cor === cor && item.tamanho === tamanho);
    const qtdAtualNoCarrinho = itemNoCarrinho ? itemNoCarrinho.qtd : 0;

    if (qtdAtualNoCarrinho >= estoqueDisponivel) return; 

    if (itemNoCarrinho) {
        itemNoCarrinho.qtd += 1;
    } else {
        carrinho.push({ id, nome, preco: v2n(preco), cor, tamanho, foto, qtd: 1, idCor: idCor, idTam: idTam });
    }

    salvarCarrinhoNoCache();
    atualizarInterfaceCarrinho();

    if (typeof selecionarVariacaoFinal === "function") {
        selecionarVariacaoFinal(id, cor, tamanho, estoqueDisponivel, idCor, idTam);
    }

    if (window.innerWidth < 992) abrirGavetaCarrinho();
}

function abrirGavetaCarrinho() {
    const el = document.getElementById('offcanvasCarrinho');
    if (!el) return console.error("Elemento offcanvasCarrinho não encontrado!");
    try {
        const instance = bootstrap.Offcanvas.getOrCreateInstance(el);
        instance.show();
    } catch (e) {
        const btnNavbar = document.querySelector('[data-bs-target="#offcanvasCarrinho"]');
        if (btnNavbar) btnNavbar.click();
    }
}

function alterarQtd(index, delta) {
    const itemNoCarrinho = carrinho[index];
    if (delta > 0) {
        const produtoOriginal = bancoDeDados.find(p => String(p.id) === String(itemNoCarrinho.id));
        const variacaoOficial = produtoOriginal?.variacoes?.find(v => v.cor === itemNoCarrinho.cor && v.tamanho === itemNoCarrinho.tamanho);
        const estoqueDisponivel = variacaoOficial ? Number(variacaoOficial.quantidade) : 0;
        if (itemNoCarrinho.qtd >= estoqueDisponivel) {
            console.warn("Ação bloqueada: Estoque insuficiente para " + itemNoCarrinho.nome);
            return; 
        }
    }

    itemNoCarrinho.qtd += delta;

    if (itemNoCarrinho.qtd <= 0) {
        removerDoCarrinho(index);
    } else {
        salvarCarrinhoNoCache();
        atualizarInterfaceCarrinho();
    }
}

function atualizarInterfaceCarrinho() {
  const containerFixo = document.getElementById('itens-carrinho-fixo');
  const containerMobile = document.getElementById('itens-carrinho-mobile');
  const painelLateral = document.getElementById('carrinho-global-lateral');
  const badge = document.getElementById('cart-count');
  
  if (carrinho.length === 0) {
    if (painelLateral) painelLateral.style.display = 'none';
    if (badge) { badge.style.display = 'none'; badge.innerText = ""; }
    const msgVazio = '<p class="text-center text-muted small mt-5">Vazio</p>';
    if (containerFixo) containerFixo.innerHTML = msgVazio;
    if (containerMobile) containerMobile.innerHTML = msgVazio;
    if (document.getElementById('total-carrinho-fixo')) document.getElementById('total-carrinho-fixo').innerText = n2v(0);
    if (document.getElementById('total-carrinho-mobile')) document.getElementById('total-carrinho-mobile').innerText = n2v(0);
    return;
  }

  if (window.innerWidth > 991) {
    if (painelLateral) painelLateral.style.display = 'block';
  } else {
    if (painelLateral) painelLateral.style.display = 'none';
  }

  let totalDinheiro = 0;
  let totalItens = 0;

  const htmlItens = carrinho.map((item, index) => {
    totalDinheiro += (item.preco * item.qtd);
    totalItens += item.qtd;

    const produtoOriginal = bancoDeDados.find(p => String(p.id) === String(item.id));
    const variacaoOficial = produtoOriginal?.variacoes?.find(v => v.cor === item.cor && v.tamanho === item.tamanho);
    
    const estoqueDisponivel = variacaoOficial ? Number(variacaoOficial.quantidade) : 0;
    const atingiuLimite = item.qtd >= estoqueDisponivel;

    const iconeMenos = item.qtd === 1 ? 'bi-trash' : 'bi-dash';

    return `
      <div class="ewc-item" style="position: relative; padding-bottom: ${atingiuLimite ? '15px' : '0'};">
        <img src="${item.foto}" alt="${item.nome}">
        <div class="ewc-item-name" style="color: #000 !important; font-weight: bold !important;">${item.nome}</div>
        <div class="ewc-item-price" style="color: #B12704 !important; font-weight: bold !important;">${n2v(item.preco * item.qtd)}</div>
        <div class="ewc-item-meta" style="color: #000 !important; font-weight: bold !important;">${item.cor} | ${item.tamanho}</div>
        
        <div class="a-stepper-container">
            <button class="a-stepper-btn" onclick="alterarQtd(${index}, -1)">
                <i class="bi ${iconeMenos}"></i>
            </button>
            <div class="a-stepper-value">${item.qtd}</div>
            <button class="a-stepper-btn" onclick="alterarQtd(${index}, 1)" ${atingiuLimite ? 'disabled style="opacity: 0.2; cursor: not-allowed;"' : ''}>
                <i class="bi bi-plus"></i>
            </button>
        </div>
        ${atingiuLimite ? `<div class="text-danger fw-bold" style="font-size: 8px; text-align: center; width: 100%; margin-top: 2px;">LIMITE EM ESTOQUE</div>` : ''}
      </div>`;
  }).join('');

  if (containerFixo) containerFixo.innerHTML = htmlItens;
  if (containerMobile) containerMobile.innerHTML = htmlItens;

  const valorFormatado = n2v(totalDinheiro);
  if (document.getElementById('total-carrinho-fixo')) document.getElementById('total-carrinho-fixo').innerText = valorFormatado;
  if (document.getElementById('total-carrinho-mobile')) document.getElementById('total-carrinho-mobile').innerText = valorFormatado;

  if (badge) {
    badge.innerText = totalItens;
    badge.style.display = 'flex';
  }
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    salvarCarrinhoNoCache();
    atualizarInterfaceCarrinho();
}

function enviarPedidoWhatsApp() {
    if (carrinho.length === 0) { alert("Seu carrinho está vazio!"); return; }

    let mensagem = "*NOVO PEDIDO - VITRINE VIRTUAL*\n";
    mensagem += "------------------------------------------\n\n";
    let totalGeral = 0;

    carrinho.forEach((item, i) => {
        const subtotalItem = item.preco * item.qtd;
        totalGeral += subtotalItem;
        const skuEstoque = String(item.id) + String(item.idTam) + String(item.idCor);

        mensagem += `*${i + 1}. ${item.nome}*\n`;
        mensagem += `🔹 SKU: ${skuEstoque}\n`; 
        mensagem += `🔹 Cor: ${item.cor} | Tam: ${item.tamanho}\n`;
        
        if (item.qtd > 1) {
            mensagem += `🔢 Qtd: ${item.qtd} x ${n2v(item.preco)}\n`;
            mensagem += `💰 Subtotal: ${n2v(subtotalItem)}\n\n`;
        } else {
            mensagem += `💰 Preço: ${n2v(item.preco)}\n\n`;
        }
    });

    mensagem += "------------------------------------------\n";
    mensagem += `*TOTAL ESTIMADO: ${n2v(totalGeral)}*\n\n`;
    mensagem += "Gostaria de confirmar a disponibilidade destes items.";

    const telefoneFinal = window.SEU_TELEFONE_LOJA || "SEU_TELEFONE";
    const url = 'https://api.whatsapp.com/send?phone=' + telefoneFinal + '&text=' + encodeURIComponent(mensagem);
    
    window.open(url, '_blank');

    carrinho = []; 
    salvarCarrinhoNoCache(); 
    atualizarInterfaceCarrinho();
}

function salvarCarrinhoNoCache() { localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho)); }

function carregarCarrinhoDoCache() {
  const cache = localStorage.getItem(CHAVE_CARRINHO);
  if (cache) {
    try {
      carrinho = JSON.parse(cache);
      atualizarInterfaceCarrinho();
    } catch (e) { console.error("Erro ao carregar carrinho:", e); carrinho = []; }
  }
}

function gerenciarCliqueCarrinho() {
  if (window.innerWidth < 992) {
    const el = document.getElementById('offcanvasCarrinho');
    if (el && typeof bootstrap !== 'undefined') {
      const instancia = bootstrap.Offcanvas.getOrCreateInstance(el);
      instancia.show();
    }
  } else {
    console.log("Clique ignorado: Carrinho fixo já visível no Desktop.");
  }
}

/**
 * =================================================================================
 * 7. SISTEMA DE ZOOM E INTERAÇÃO
 * =================================================================================
 */

let zoomAtual = 1; 
let isDragging = false; 
let startX = 0, startY = 0; 
let translateX = 0, translateY = 0; 

function abrirZoomModal(idProduto, indiceInicial) {
   var container = document.getElementById('modal-container');
   if (!container) return;
   if (typeof bootstrap === 'undefined') return;

   var p = bancoDeDados.find(x => String(x.id) === String(idProduto));
   if (!p) return;

   var fotos = (Array.isArray(p.todasFotos) && p.todasFotos.length > 0) ? p.todasFotos : [];
   var imagensZoom = fotos.map(function(url) { return processarImg(url, true); });

   zoomAtual = 1; translateX = 0; translateY = 0; isDragging = false;

   var htmlModal = `
     <div class="modal fade" id="modalZoom" tabindex="-1" aria-hidden="true">
       <div class="modal-dialog modal-fullscreen">
         <div class="modal-content" style="background-color: #000;">
           <div id="carouselZoom" class="carousel slide w-100 h-100" data-bs-interval="false">
              <div class="carousel-inner h-100">
               ${fotos.map(function(urlDrive, i) {
                  var activeClass = (i === indiceInicial) ? 'active' : '';
                  var idOtimizadoEspecifico = (Array.isArray(p.idOtimizado) && p.idOtimizado[i]) ? p.idOtimizado[i] : null;
                  return `
                    <div class="carousel-item ${activeClass} h-100">
                      <div class="img-zoom-container w-100 h-100 d-flex align-items-center justify-content-center" style="padding-bottom: 80px;">
                        <img ${obterAtributosImagem(p.id, urlDrive, true, idOtimizadoEspecifico)} 
                            class="d-block" id="img-zoom-${i}"
                            style="max-height: 82vh; max-width: 100vw; object-fit: contain;"
                            onmousedown="iniciarArrasto(event)" onmousemove="arrastar(event)"
                            onmouseup="pararArrasto()" onmouseleave="pararArrasto()"
                            onwheel="controlarZoomScroll(event)" referrerpolicy="no-referrer">
                      </div>
                    </div>`;
                }).join('')}
             </div>
             ${imagensZoom.length > 1 ? `
               <button class="carousel-control-prev" type="button" data-bs-target="#carouselZoom" data-bs-slide="prev" onclick="resetarZoomAoMudar()" style="z-index: 1090;">
                 <span class="carousel-control-prev-icon p-3 bg-dark rounded-circle border border-secondary" aria-hidden="true"></span>
               </button>
               <button class="carousel-control-next" type="button" data-bs-target="#carouselZoom" data-bs-slide="next" onclick="resetarZoomAoMudar()" style="z-index: 1090;">
                 <span class="carousel-control-next-icon p-3 bg-dark rounded-circle border border-secondary" aria-hidden="true"></span>
               </button>
             ` : ''}
             <button type="button" class="btn-close-custom" data-bs-dismiss="modal" aria-label="Close" style="z-index: 1100;"><i class="bi bi-x-lg"></i></button>
             <div class="zoom-toolbar" style="z-index: 1100;">
                <button onclick="aplicarZoom(-0.5)"><i class="bi bi-dash-lg"></i></button>
                <button onclick="aplicarZoom(0)"><i class="bi bi-aspect-ratio"></i></button>
                <button onclick="aplicarZoom(0.5)"><i class="bi bi-plus-lg"></i></button>
             </div>
           </div>
         </div>
       </div>
     </div>
   `;
   
   container.innerHTML = htmlModal;
   try {
     var elModal = document.getElementById('modalZoom');
     document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
     var modalInstance = new bootstrap.Modal(elModal);
     modalInstance.show();
   } catch (e) { console.error("Erro ao abrir modal de zoom:", e); }
}

function aplicarZoom(fator) {
  if (fator === 0) {
    zoomAtual = 1; translateX = 0; translateY = 0;
  } else {
    zoomAtual = Math.round((zoomAtual + fator) * 100) / 100;
  }
  if (zoomAtual < 1) zoomAtual = 1;
  if (zoomAtual > 5) zoomAtual = 5; 
  if (zoomAtual === 1) { translateX = 0; translateY = 0; }
  atualizarTransformacao();
}

function controlarZoomScroll(event) {
    event.preventDefault();
    const direcao = Math.sign(event.deltaY) * -1;
    aplicarZoom(direcao * 0.2);
}

function resetarZoomAoMudar() {
  zoomAtual = 1; translateX = 0; translateY = 0;
  document.querySelectorAll('#carouselZoom img').forEach(img => {
      img.style.transform = 'translate(0px, 0px) scale(1)';
      img.classList.remove('grabbing');
  });
}

function getClientX(event) { return event.touches ? event.touches[0].clientX : event.clientX; }
function getClientY(event) { return event.touches ? event.touches[0].clientY : event.clientY; }

function iniciarArrasto(event) {
    if (zoomAtual <= 1) return;
    event.preventDefault(); isDragging = true;
    startX = getClientX(event) - translateX; startY = getClientY(event) - translateY;
    event.target.classList.add('grabbing');
}

function arrastar(event) {
    if (!isDragging) return;
    event.preventDefault();
    translateX = getClientX(event) - startX; translateY = getClientY(event) - startY;
    atualizarTransformacao();
}

function pararArrasto() {
    isDragging = false;
    var imgAtiva = document.querySelector('#carouselZoom .carousel-item.active img');
    if(imgAtiva) imgAtiva.classList.remove('grabbing');
}

function atualizarTransformacao() {
    var imgAtiva = document.querySelector('#carouselZoom .carousel-item.active img');
    if (imgAtiva) imgAtiva.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomAtual})`;
}

/**
 * =================================================================================
 * 8. IDENTIDADE VISUAL E CONFIGURAÇÃO (APPCONFIG)
 * =================================================================================
 */

const AppConfig = {
  data: {},
  init: function() {
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
 * 10 e 11. RENDERIZAÇÃO DA PÁGINA DE PRODUTO
 * =================================================================================
 */

function verProduto(id, adicionarAoHistorico) {
  if (adicionarAoHistorico === undefined) adicionarAoHistorico = true;

  var p = bancoDeDados.find(x => String(x.id) === String(id));
  if (!p) { console.warn("Produto não encontrado no banco local:", id); return; }

  if (adicionarAoHistorico) window.history.pushState({ view: 'pdp', id: id }, "", "?p=" + id);

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

function renderizarDetalhesProduto(p) {
  var divConteudo = document.getElementById('pdp-wrapper');
  var vVenda = v2n(p.valorVenda);
  var vPromo = v2n(p.valorPromo);
  var vPix = v2n(p.valorPix);
  
  var estaEmPromo = p.isPromoAtiva !== undefined ? p.isPromoAtiva : vPromo > 0;
  var temPix = p.isPixAtivo !== undefined ? p.isPixAtivo : vPix > 0;
  var precoFinal = estaEmPromo ? vPromo : vVenda;
  var isEsgotado = p.estoque <= 0;

  var fotos = (Array.isArray(p.todasFotos) && p.todasFotos.length > 0) ? p.todasFotos : [];
  var fotosProcessadas = fotos.length > 0 ? fotos.map(function(url) { return processarImg(url, true); }) : ['https://via.placeholder.com/600x600?text=Sem+Foto'];

  var htmlOpcoesCompra = "";
  if (isEsgotado) {
    htmlOpcoesCompra = `
      <div class="alert alert-danger text-center fw-bold rounded shadow-sm mb-4">
        <i class="bi bi-x-circle me-2"></i> PRODUTO ESGOTADO
      </div>
      <button onclick="abrirModalAviso('${safeId(p.sku || p.id)}', '${safeId(p.nome)}')" class="btn btn-dark w-100 py-3 fw-bold rounded shadow-sm animate__animated animate__pulse">
        <i class="bi bi-bell-fill text-warning me-2"></i> AVISE-ME QUANDO CHEGAR
      </button>
      <p class="text-muted small text-center mt-2">Te mandaremos um WhatsApp assim que repormos o estoque!</p>
    `;
  } else {
    htmlOpcoesCompra = `
         <div class="mb-3">
           <label class="small fw-bold d-block mb-2 text-muted">1. ESCOLHA O TAMANHO:</label>
           <div class="d-flex flex-wrap gap-2">${gerarHTMLTamanhos(p)}</div>
         </div>
         <div>
           <label class="small fw-bold d-block mb-2 text-muted">2. ESCOLHA A COR:</label>
           <div id="container-cores-${p.id}" class="d-flex flex-wrap gap-2">
             <span class="text-muted small fst-italic">Selecione um tamanho acima para ver as cores...</span>
           </div>
         </div>
         <div id="container-estoque-${p.id}" class="mt-3"></div>
          <a id="btn-whatsapp-${p.id}" href="javascript:void(0)" 
            class="btn w-100 py-3 mt-3 rounded shadow-sm fw-bold animate__animated animate__fadeInUp" 
            style="display:none; transition: all 0.3s; background-color: #FF4F95; border-color: #FF4F95; color: #FFFFFF;">
            <i class="bi bi-cart-plus me-2"></i> ADICIONAR AO CARRINHO
          </a>
    `;
  }

  divConteudo.innerHTML = `
    <div class="col-md-5">
      <div id="pdp-carousel" class="carousel slide border rounded bg-white shadow-sm">
        <div class="carousel-inner">
          ${fotos.map(function(urlDrive, i) {
            var activeClass = (i === 0) ? 'active' : '';
            var idOtimizadoUnico = (p.idOtimizado && p.idOtimizado[i]) ? p.idOtimizado[i] : null;
            return `
              <div class="carousel-item ${activeClass}">
                <div class="ratio" style="--bs-aspect-ratio: 125%; background-color: #fff;">
                  <img ${obterAtributosImagem(p.id, urlDrive, false, idOtimizadoUnico)} 
                      class="object-fit-cover" style="width: 100%; height: 100%; cursor: zoom-in;" 
                      onclick="abrirZoomModal('${safeId(p.id)}', ${i})" referrerpolicy="no-referrer">
                </div>
              </div>`;
          }).join('')}
        </div>
        ${fotosProcessadas.length > 1 ? `
          <button class="carousel-control-prev" type="button" data-bs-target="#pdp-carousel" data-bs-slide="prev">
            <span class="carousel-control-prev-icon bg-secondary rounded-circle p-2" aria-hidden="true" style="width:2.5rem;height:2.5rem;background-size:50%"></span>
          </button>
          <button class="carousel-control-next" type="button" data-bs-target="#pdp-carousel" data-bs-slide="next">
            <span class="carousel-control-next-icon bg-secondary rounded-circle p-2" aria-hidden="true" style="width:2.5rem;height:2.5rem;background-size:50%"></span>
          </button>
        ` : ''}
      </div>
      <div class="text-center mt-2 text-muted small"><i class="bi bi-zoom-in"></i> Toque na imagem para ampliar</div>
    </div>
    <div class="col-md-7 ps-md-4">
      <button onclick="voltarParaHome()" class="btn btn-link text-decoration-none p-0 mb-2 small fw-bold" style="color: #FF4F95 !important;">
       <i class="bi bi-arrow-left"></i> Voltar para a loja
      </button>
      <h3 class="fw-bold text-dark mb-1">${p.nome}</h3>
      <p class="text-muted small mb-3">Ref: ${p.id} | Categoria: ${p.categoria}</p>
      ${!isEsgotado ? `
      <div class="p-3 bg-light rounded border mb-4">
        ${estaEmPromo ? '<small class="text-decoration-line-through text-muted">De: ' + n2v(vVenda) + '</small>' : ''}
        <div class="d-flex align-items-center gap-2">
          <h2 class="fw-bold mb-0 text-primary">${n2v(precoFinal)}</h2>
          ${estaEmPromo ? '<span class="badge bg-danger">OFERTA</span>' : ''}
        </div>
        ${temPix ? '<div class="text-success small fw-bold mt-1"><i class="bi bi-qr-code"></i> ou ' + n2v(vPix) + ' via PIX</div>' : ''}
      </div>
      ` : ''}
      <div class="card p-3 border-0 bg-light shadow-sm mb-4">${htmlOpcoesCompra}</div>
      <div class="mb-4">
        <h6 class="fw-bold small text-uppercase text-muted border-bottom pb-1">Descrição</h6>
        <p class="text-secondary small mt-2" style="white-space: pre-line; line-height: 1.5;">${p.descricao || 'Este produto não possui descrição detalhada.'}</p>
      </div>
    </div>`;
    
  var carrosselEl = document.getElementById('pdp-carousel');
  if (carrosselEl) new bootstrap.Carousel(carrosselEl);
}

function renderizarChipsCategorias() {
  if (bancoDeDados.length === 0) return;
  var validos = bancoDeDados.filter(p => (v2n(p.valorVenda) > 0 || v2n(p.valorPromo) > 0));
  var categorias = [...new Set(validos.map(p => p.categoria))].filter(Boolean).sort();
  var container = document.getElementById('container-chips-categorias');
  if (!container) return; 

  var htmlCats = categorias.map(cat => `
      <button onclick="filtrarPorCategoriaTopo('${cat}', this)" 
              class="btn btn-sm btn-chip-cat rounded-pill px-3 text-uppercase text-nowrap flex-shrink-0 transition-all" data-cat="${cat}">
        ${cat}
      </button>
  `).join('');
  container.innerHTML = htmlCats;
}

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

    const payload = { sku: sku, nome: nomeProd, tamanho: tamanho, nomeCliente: nome, whatsapp: whatsapp };

    fetch(`${API_URL}?action=salvarAvisoProduto`, {
        method: 'POST',
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