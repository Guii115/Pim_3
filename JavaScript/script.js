// ============================================================
//  GameShop PDV — script.js v1.0
//  Conectado à API ASP.NET em http://localhost:5280
// ============================================================

// ==========================================
// 1. CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ==========================================
const API = 'http://localhost:5280/api';
let carrinho = [];             // Itens adicionados na venda atual
let produtosCache = [];        // Lista global de produtos carregada da API
let clientesCache = [];        // Lista global de clientes carregada da API
let caixaAbertoId = null;      // ID do caixa ativo retornado pelo banco/Redis

// Categorias padrões do sistema para tratamento de regras de plataforma
const CATEGORIAS = [
  { id: 1, nome: 'Jogos Mídia Física', temPlataforma: true },
  { id: 2, nome: 'Acessórios', temPlataforma: true },
  { id: 3, nome: 'Consoles', temPlataforma: false }
];

// ==========================================
// 2. FUNÇÕES UTILITÁRIAS E CONVERSORES
// ==========================================

/**
 * Corrige valores flutuantes substituindo vírgula por ponto se necessário
 * e garante retorno numérico válido.
 */
function converterParaNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'string') valor = valor.replace(',', '.');
  const num = Number(valor);
  return isNaN(num) ? 0 : num;
}

async function fazerLogin() {
  const login = document.getElementById('inputLogin').value.trim();
  const senha = document.getElementById('inputSenha').value;
  const erro  = document.getElementById('erroLogin');

  erro.innerText = '';

  if (!login || !senha) {
    erro.innerText = 'Preencha login e senha.';
    return;
  }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      erro.innerText = data.mensagem || 'Login ou senha inválidos.';
      return;
    }

    const data = await res.json();

    localStorage.setItem('token', data.token);
    localStorage.setItem('nome_usuario', data.nome);
    localStorage.setItem('cargo_usuario', data.cargo);

    const payload = JSON.parse(atob(data.token.split('.')[1]));
    localStorage.setItem('funcionario_id', payload['funcionario_id']);
    localStorage.setItem('usuario_id', payload['nameid'] || payload['unique_name'] || '');

    window.location.href = 'dashboard.html';

  } catch (e) {
    erro.innerText = 'Erro ao conectar com o servidor.';
  }
}

/**
 * Formata um valor numérico para o padrão de string monetária brasileira (R$).
 */
function dinheiro(valor) {
  return converterParaNumero(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Recupera o Token JWT ativo armazenado no navegador.
 */
function getToken() {
  return localStorage.getItem('token');
}

/**
 * Wrapper centralizado para requisições HTTP na API.
 * Adiciona cabeçalhos obrigatórios e lida com o token JWT de autenticação.
 * Se houver erro 401 (não autorizado), limpa a sessão e expulsa para o login.
 */
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(API + path, opts);

  if (res.status === 401) {
    alert('Sessão expirada. Faça login novamente.');
    fazerLogout();
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ mensagem: 'Erro desconhecido.' }));
    throw new Error(err.mensagem || 'Erro na requisição.');
  }

  if (res.status === 204) return null;
  return res.json();
}

// ==========================================
// 3. AUTENTICAÇÃO E CONTROLE DE ACESSO
// ==========================================

/**
 * Valida as credenciais na API, descriptografa o payload JWT para extrair
 * permissões e IDs e salva a sessão localmente.
 */
async function fazerLogin() {
  const login = document.getElementById('inputLogin')?.value.trim();
  const senha = document.getElementById('inputSenha')?.value;
  const erro = document.getElementById('erroLogin');

  if (erro) erro.innerText = '';

  if (!login || !senha) {
    if (erro) erro.innerText = 'Preencha login e senha.';
    return;
  }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha })
    });

    if (!res.ok) {
      if (erro) erro.innerText = 'Login ou senha inválidos.';
      return;
    }

    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('nome_usuario', data.nome);
    localStorage.setItem('cargo_usuario', data.cargo);

    // Desmembra a estrutura Base64 do JWT para salvar IDs de controle interno
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    localStorage.setItem('funcionario_id', payload['funcionario_id'] || '1');
    localStorage.setItem('usuario_id', payload['nameid'] || payload['unique_name'] || payload['id'] || '1');

    window.location.href = 'dashboard.html';
  } catch (e) {
    if (erro) erro.innerText = 'Erro ao conectar com o servidor.';
  }
}

/**
 * Remove os tokens do cache local do navegador e solicita revogação de chaves no Redis.
 */
async function fazerLogout() {
  await api('POST', '/auth/logout').catch(() => { });
  localStorage.clear();
  window.location.href = 'login.html';
}



// ==========================================
// 4. INICIALIZAÇÃO E CONTROLE DE ROTAS
// ==========================================

/**
 * Escuta o carregamento completo do DOM para gerenciar segurança de rotas,
 * injetar a barra de navegação comum (sidebar) e chamar os gatilhos de dados.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html');

  // Validação: Se não houver Token ativo e não for a tela de login, barra a rota
  if (!getToken() && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

if (isLoginPage) {
    aplicarTema();
    if (getToken()) window.location.href = 'dashboard.html';
    return;
  }

  // Rotinas comuns de páginas autenticadas
  aplicarTema();
  setInterval(atualizarRelogio, 1000);
  atualizarRelogio();

  // Controle de inatividade — desloga por AFK
  let ultimaAtividade = Date.now();
  ['mousemove', 'keydown', 'click', 'scroll'].forEach(evento => {
    document.addEventListener(evento, () => { ultimaAtividade = Date.now(); });
  });

  setInterval(() => {
    const token = getToken();
    if (!token) return;

    const cargo = localStorage.getItem('cargo_usuario') || '';
    const tempoLimite = cargo.toLowerCase() === 'gerente'
      ? 8 * 60 * 60 * 1000  // 8 horas
      : 5 * 60 * 1000;       // 5 minutos

    const inativo = Date.now() - ultimaAtividade;

    if (inativo >= tempoLimite) {
      const tema = localStorage.getItem('temaSistema');
      localStorage.clear();
      if (tema) localStorage.setItem('temaSistema', tema);
      alert('Sessão encerrada por inatividade.');
      window.location.href = 'login.html';
    } else {
      fetch('http://localhost:5280/api/produto', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => { });
    }
  }, 60 * 1000);

  const elemNome = document.getElementById('nomeUsuarioLogado');
  if (elemNome) {
    elemNome.innerText = `${localStorage.getItem('nome_usuario')} (${localStorage.getItem('cargo_usuario')})`;
  }

  // Importação assíncrona da Sidebar compartilhada
  try {
    const res = await fetch('sidebar.html');
    if (res.ok) {
      const html = await res.text();
      const sidebarContainer = document.getElementById('sidebar-container');
      if (sidebarContainer) {
        sidebarContainer.innerHTML = html;
      }
    }
  } catch (e) {
    console.error('Erro ao injetar barra de navegação compartilhada:', e);
  }

  // Roda a validação de restrições por caixa e popula os elementos visuais
  await atualizarTudo();
});

/**
 * Roteia o fluxo de dados ativando gatilhos específicos dependendo do arquivo HTML aberto.
 */
async function atualizarTudo() {
  if (!getToken()) return;

  const cargo = localStorage.getItem('cargo_usuario') || '';

  // 1. OBRIGATÓRIO: Roda a verificação de Caixa aberto no Redis para aplicar travas de menus
  await atualizarCaixa();

  // 2. Trava de cargo: Aplica a ocultação da aba Funcionários caso o usuário logado não seja Gerente
  const botoesMenu = document.querySelectorAll('.menu button');
  botoesMenu.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes('funcionarios.html')) {
      btn.style.display = cargo.toLowerCase() === 'gerente' ? 'block' : 'none';
    }

    // Gerencia a marcação de classe visual "active" no botão correspondente à tela aberta
    const path = window.location.pathname;
    if (btn.getAttribute('onclick') && path.includes(btn.getAttribute('onclick').match(/'(.*?)'/)[1])) {
      btn.classList.add('active');
    }
  });

  // 3. Execução de rotinas exclusivas por tela
  const path = window.location.pathname;
  if (path.includes('dashboard.html')) {
    atualizarDashboard();
  }
  else if (path.includes('produtos.html')) {
    await listarProdutos();
    await preencherCodigoAutomatico();
  }
  else if (path.includes('clientes.html')) {
    await listarClientes();
  }
  else if (path.includes('vendas.html')) {
    await listarVendas();
  }
  else if (path.includes('pdv.html')) {
    await listarProdutos();
    await listarClientes();
  }
}

// ==========================================
// 5. MÓDULO DE PRODUTOS
// ==========================================

/**
 * Altera a exibição do campo Plataforma dependendo da Categoria selecionada no cadastro.
 */
function onCategoriaChange() {
  const idCategoria = parseInt(document.getElementById('categoriaProduto')?.value);
  const cat = CATEGORIAS.find(c => c.id === idCategoria);
  const campoPlatforma = document.getElementById('campoPlatforma');

  if (campoPlatforma) {
    campoPlatforma.style.display = cat?.temPlataforma ? 'block' : 'none';
  }
  if (!cat?.temPlataforma) {
    const plat = document.getElementById('plataformaProduto');
    if (plat) plat.value = '';
  }
}

/**
 * Consulta na API o próximo código sequencial sugerido para o produto.
 */
async function preencherCodigoAutomatico() {
  if (document.getElementById('produtoEditando')?.value) return;
  try {
    const res = await api('GET', '/produto/proximo-codigo');
    const input = document.getElementById('codigoFiscalProduto');
    if (input && res) input.value = res.codigo;
  } catch (e) {
    console.error('Erro ao gerar sequencial de código fiscal:', e);
  }
}

/**
 * Cadastra ou atualiza um produto na base de dados (Lida com conversão opcional de foto para Base64).
 */
async function salvarProduto() {
  const fotoInput = document.getElementById('fotoProduto');
  const editando = document.getElementById('produtoEditando').value;
  const nome = document.getElementById('nomeProduto').value.trim();
  const idCategoria = parseInt(document.getElementById('categoriaProduto').value);
  const plataforma = document.getElementById('plataformaProduto').value;
  const preco = parseFloat(document.getElementById('precoProduto').value);
  const quantidade = parseInt(document.getElementById('quantidadeProduto').value);
  const codigoFiscal = document.getElementById('codigoFiscalProduto').value.trim();

  const cat = CATEGORIAS.find(c => c.id === idCategoria);

  if (!nome || isNaN(preco) || isNaN(quantidade) || !idCategoria) {
    alert('Preencha todos os campos obrigatorios.');
    return;
  }
  if (cat?.temPlataforma && !plataforma) {
    alert('Selecione a plataforma para esta categoria.');
    return;
  }

  const enviarParaApi = async (fotoUrl) => {
    const body = {
      codigoFiscal, nome, preco, quantidade, fotoUrl,
      plataforma: cat?.temPlataforma ? plataforma : null,
      quantidadeEstoque: quantidade,
      estoqueMinimo: 3,
      idCategoria
    };

    try {
      if (editando) {
        await api('PUT', `/produto/${editando}`, body);
        alert('Produto atualizado com sucesso!');
      } else {
        await api('POST', '/produto', body);
        alert('Produto cadastrado com sucesso!');
      }
      limparProduto();
      await listarProdutos();
    } catch (e) {
      alert('Erro ao salvar produto: ' + e.message);
    }
  };

  if (fotoInput?.files?.length > 0) {
    const reader = new FileReader();
    reader.onload = e => enviarParaApi(e.target.result);
    reader.readAsDataURL(fotoInput.files[0]);
  } else {
    const fotoAtual = editando
      ? (produtosCache.find(p => p.id == editando)?.fotoUrl || null)
      : null;
    await enviarParaApi(fotoAtual);
  }
}

/**
 * Reseta os campos do formulário de produto.
 */
function limparProduto() {
  const ids = ['fotoProduto', 'codigoFiscalProduto', 'nomeProduto', 'categoriaProduto', 'plataformaProduto', 'precoProduto', 'quantidadeProduto', 'produtoEditando'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const cp = document.getElementById('campoPlatforma');
  if (cp) cp.style.display = 'none';
  preencherCodigoAutomatico();
}

/**
 * Busca produtos na API, salva na memória cache local (essencial para o PDV funcionar)
 * e renderiza a tabela caso o elemento HTML esteja presente.
 */
async function listarProdutos() {
  try {
    const produtos = await api('GET', '/produto');
    produtosCache = produtos || [];

    const lista = document.getElementById('listaProdutos');
    if (!lista) return; // Encerra silenciosamente caso esteja em outra tela (Ex: PDV)

    lista.innerHTML = '';
    if (produtosCache.length === 0) {
      lista.innerHTML = '<tr><td colspan="8">Nenhum produto cadastrado.</td></tr>';
      return;
    }

    produtosCache.forEach(p => {
      const cat = CATEGORIAS.find(c => c.id === p.idCategoria);
      lista.innerHTML += `
        <tr>
          <td>${p.fotoUrl ? `<img src="${p.fotoUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` : 'Sem foto'}</td>
          <td>${p.codigoFiscal || '-'}</td>
          <td>${p.nome}</td>
          <td>${cat?.nome || p.nomeCategoria || '-'}</td>
          <td>${p.plataforma || '-'}</td>
          <td>${dinheiro(p.preco)}</td>
          <td>${p.quantidadeEstoque ?? p.quantidade}</td>
          <td>
            <button class="btn btn-edit" onclick="editarProduto(${p.id})">Editar</button>
            <button class="btn btn-danger" onclick="excluirProduto(${p.id})">Excluir</button>
          </td>
        </tr>`;
    });
  } catch (e) {
    const lista = document.getElementById('listaProdutos');
    if (lista) lista.innerHTML = `<tr><td colspan="8">Erro: ${e.message}</td></tr>`;
  }
}

/**
 * Carrega os dados do cache de volta para os inputs de produto para edição.
 */
function editarProduto(id) {
  const p = produtosCache.find(x => x.id === id);
  if (!p) return;

  document.getElementById('produtoEditando').value = id;
  document.getElementById('codigoFiscalProduto').value = p.codigoFiscal || '';
  document.getElementById('nomeProduto').value = p.nome;
  document.getElementById('categoriaProduto').value = p.idCategoria || '';
  document.getElementById('precoProduto').value = p.preco;
  document.getElementById('quantidadeProduto').value = p.quantidadeEstoque ?? p.quantidade;

  onCategoriaChange();
  document.getElementById('plataformaProduto').value = p.plataforma || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Exclui de forma física ou lógica um produto por ID através da API.
 */
async function excluirProduto(id) {
  if (!confirm('Deseja excluir este produto?')) return;
  try {
    await api('DELETE', `/produto/${id}`);
    if (document.getElementById('produtoEditando')?.value == id) {
      limparProduto();
    }
    await listarProdutos();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
}

// ==========================================
// 6. MÓDULO DE CLIENTES
// ==========================================

/**
 * Reseta o formulário de dados de clientes e suas mensagens de validação.
 */
function limparFormularioCliente() {
  document.getElementById('clienteEditando').value = '';
  ['nomeCliente', 'cpfCliente', 'telefoneCliente', 'emailCliente'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  limparErrosClientes();
}

/**
 * Remove textos internos de spans ou parágrafos de validação de clientes.
 */
function limparErrosClientes() {
  ['erroNome', 'erroCpf', 'erroTelefone', 'erroEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = '';
  });
}

/**
 * Executa as validações estruturais de campos (Regex e Tamanho) antes de enviar o cliente para a API.
 */
async function salvarCliente() {
  limparErrosClientes();
  const editando = document.getElementById('clienteEditando').value;
  const nome = document.getElementById('nomeCliente').value.trim();
  const cpfRaw = document.getElementById('cpfCliente').value.trim();
  const telRaw = document.getElementById('telefoneCliente').value.trim();
  const email = document.getElementById('emailCliente').value.trim();

  let temErro = false;

  if (!nome) { document.getElementById('erroNome').innerText = 'Nome obrigatorio'; temErro = true; }

  const cpfLimpo = cpfRaw.replace(/\D/g, '');
  if (!cpfRaw) { document.getElementById('erroCpf').innerText = 'CPF obrigatorio'; temErro = true; }
  else if (cpfLimpo.length !== 11) { document.getElementById('erroCpf').innerText = 'CPF invalido'; temErro = true; }

  const telLimpo = telRaw.replace(/\D/g, '');
  if (!telRaw) { document.getElementById('erroTelefone').innerText = 'Telefone obrigatorio'; temErro = true; }
  else if (telLimpo.length < 10 || telLimpo.length > 11) { document.getElementById('erroTelefone').innerText = 'Telefone invalido'; temErro = true; }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('erroEmail').innerText = 'E-mail invalido'; temErro = true; }

  if (temErro) return;

  const body = {
    nome,
    cpfCnpj: cpfLimpo,
    telefone: `+55${telLimpo}`,
    email: email || null
  };

  try {
    if (editando) {
      await api('PUT', `/cliente/${editando}`, body);
      alert('Cliente atualizado com sucesso!');
    } else {
      await api('POST', '/cliente', body);
      alert('Cliente cadastrado com sucesso!');
    }
    limparFormularioCliente();
    await listarClientes();
  } catch (e) {
    if (e.message.toLowerCase().includes('cpf')) {
      document.getElementById('erroCpf').innerText = 'CPF ja cadastrado';
    } else {
      alert('Erro ao salvar: ' + e.message);
    }
  }
}

/**
 * Carrega a lista de clientes da API para uso geral do sistema e cache.
 */
async function listarClientes() {
  try {
    const clientes = await api('GET', '/cliente');
    clientesCache = clientes || [];

    const lista = document.getElementById('listaClientes');
    if (!lista) return;

    renderizarTabelaClientes(clientesCache);
  } catch (e) {
    const lista = document.getElementById('listaClientes');
    if (lista) lista.innerHTML = `<tr><td colspan="5">Erro: ${e.message}</td></tr>`;
  }
}

/**
 * Cria linhas HTML dinâmicas para renderizar clientes cadastrados.
 */
function renderizarTabelaClientes(listaClientes) {
  const lista = document.getElementById('listaClientes');
  if (!lista) return;

  lista.innerHTML = '';
  if (listaClientes.length === 0) {
    lista.innerHTML = '<tr><td colspan="5">Nenhum cliente encontrado.</td></tr>';
    return;
  }

  listaClientes.forEach(c => {
    lista.innerHTML += `
      <tr>
        <td>${c.nome}</td>
        <td>${formatarCPFExibicao(c.cpfCnpj)}</td>
        <td>${formatarTelefoneExibicao(c.telefone)}</td>
        <td>${c.email || '-'}</td>
        <td>
          <button class="btn btn-edit" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editarCliente(${c.id})">Editar</button>
          <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="excluirCliente(${c.id})">Excluir</button>
        </td>
      </tr>`;
  });
}

/**
 * Preenche o formulário de clientes para edição com base em um ID.
 */
function editarCliente(id) {
  const cliente = clientesCache.find(x => x.id === id);
  if (!cliente) return;

  document.getElementById('clienteEditando').value = id;
  document.getElementById('nomeCliente').value = cliente.nome;
  document.getElementById('cpfCliente').value = formatarCPFExibicao(cliente.cpfCnpj);
  document.getElementById('telefoneCliente').value = formatarTelefoneExibicao(cliente.telefone);
  document.getElementById('emailCliente').value = cliente.email || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Realiza a exclusão de um registro de cliente por ID via chamada à API.
 */
async function excluirCliente(id) {
  if (!confirm('Deseja realmente excluir este cliente?')) return;
  try {
    await api('DELETE', `/cliente/${id}`);
    if (document.getElementById('clienteEditando')?.value == id) {
      limparFormularioCliente();
    }
    alert('Cliente removido com sucesso!');
    await listarClientes();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
}

/**
 * Filtra dinamicamente a listagem de clientes sem fazer novas requisições (Busca Local no Cache).
 */
function filtrarClientes() {
  const termo = document.getElementById('buscarCliente').value.toLowerCase();
  const filtrados = clientesCache.filter(c => c.nome.toLowerCase().includes(termo));
  renderizarTabelaClientes(filtrados);
}

// ==========================================
// 7. MÓDULO FRENTE DE CAIXA (Venda / PDV)
// ==========================================

/**
 * Filtra os produtos salvos no cache para renderizar o catálogo de seleção do caixa em tempo real.
 */
function buscarProdutosPDV() {
  const termo = document.getElementById('buscarProduto')?.value.toLowerCase();
  const resultadoBusca = document.getElementById('resultadoBusca');
  if (!resultadoBusca) return;

  resultadoBusca.innerHTML = '';
  if (!termo) return;

  const filtrados = produtosCache.filter(p =>
    p.nome.toLowerCase().includes(termo) && (p.quantidadeEstoque ?? p.quantidade) > 0
  );

  filtrados.forEach(p => {
    const cat = CATEGORIAS.find(c => c.id === p.idCategoria);
    resultadoBusca.innerHTML += `
      <div class="product-card">
        <div class="product-info">
          ${p.fotoUrl ? `<img src="${p.fotoUrl}">` : ''}
          <div>
            <strong>${p.nome}</strong><br>
            <small>${cat?.nome || '-'} ${p.plataforma ? '| ' + p.plataforma : ''} | Estoque: ${p.quantidadeEstoque ?? p.quantidade}</small><br>
            <strong>${dinheiro(p.preco)}</strong>
          </div>
        </div>
        <button class="btn" onclick="adicionarCarrinho(${p.id})">Adicionar</button>
      </div>`;
  });

  if (filtrados.length === 0) resultadoBusca.innerHTML = '<p>Nenhum produto encontrado.</p>';
}

/**
 * Incrementa itens ou inclui novos objetos estruturais no array carrinho da venda atual.
 */
function adicionarCarrinho(produtoId) {
  const produto = produtosCache.find(p => p.id === produtoId);
  if (!produto) return;

  const estoque = produto.quantidadeEstoque ?? p.quantidade;
  if (estoque <= 0) { alert('Produto sem estoque.'); return; }

  const item = carrinho.find(i => i.idProduto === produtoId);
  if (item) {
    if (item.quantidade >= estoque) { alert('Quantidade maior que o estoque disponivel.'); return; }
    item.quantidade++;
  } else {
    carrinho.push({
      idProduto: produtoId,
      nome: produto.nome,
      preco: produto.preco,
      quantidade: 1
    });
  }
  atualizarCarrinho();
}

/**
 * Recalcula o subtotal, abate descontos e renderiza o troco em tempo real no HTML do carrinho.
 */
function atualizarCarrinho() {
  const itensCarrinho = document.getElementById('itensCarrinho');
  if (!itensCarrinho) return;

  itensCarrinho.innerHTML = '';
  let subtotal = 0;

  carrinho.forEach((item, i) => {
    subtotal += item.preco * item.quantidade;
    itensCarrinho.innerHTML += `
      <div class="cart-item">
        ${item.nome} | Qtd: ${item.quantidade} | ${dinheiro(item.preco * item.quantidade)}
        <button class="btn btn-danger" onclick="removerCarrinho(${i})">Remover</button>
      </div>`;
  });

  const desconto = parseFloat(document.getElementById('descontoVenda')?.value) || 0;
  const total = Math.max(subtotal - desconto, 0);
  const pago = parseFloat(document.getElementById('valorPago')?.value) || 0;
  const forma = document.getElementById('formaPagamento')?.value;

  document.getElementById('totalCarrinho').innerText = dinheiro(total);
  document.getElementById('trocoVenda').innerText = forma === 'dinheiro' ? dinheiro(Math.max(pago - total, 0)) : 'R$ 0,00';
}

/**
 * Remove uma linha específica do carrinho baseado no índice do array.
 */
function removerCarrinho(i) {
  carrinho.splice(i, 1);
  atualizarCarrinho();
}

/**
 * Valida as travas de negócio obrigatórias e submete a venda estruturada para persistência da API.
 */
async function finalizarVenda() {
  // CRÍTICO: Bloqueia a consolidação de vendas se o ID do Caixa for nulo
  if (!caixaAbertoId) {
    alert('Acesso negado: O caixa precisa estar aberto para realizar vendas!');
    return;
  }

  if (carrinho.length === 0) { alert('Carrinho vazio.'); return; }

  const idClienteStr = document.getElementById('vendaClienteId').value;
  const desconto = parseFloat(document.getElementById('descontoVenda').value) || 0;
  const formaPag = document.getElementById('formaPagamento').value;
  const valorPago = parseFloat(document.getElementById('valorPago').value) || null;

  let totalVenda = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  totalVenda = Math.max(totalVenda - desconto, 0);

  if (formaPag === 'dinheiro') {
    const pago = parseFloat(document.getElementById('valorPago').value) || 0;
    if (pago < totalVenda) {
      alert(`Valor insuficiente! Total é ${dinheiro(totalVenda)} e foi informado ${dinheiro(pago)}.`);
      return;
    }
  }

  const body = {
    IdCliente: idClienteStr ? parseInt(idClienteStr) : null,
    IdUsuario: parseInt(localStorage.getItem('usuario_id') || '1'),
    IdFuncionario: parseInt(localStorage.getItem('funcionario_id') || '1'),
    Desconto: desconto,
    FormaPagamento: formaPag,
    ValorPago: valorPago,
    Total: totalVenda,
    itens: carrinho.map(i => ({
      IdProduto: i.idProduto,
      Quantidade: i.quantidade,
      PrecoUnitario: i.preco
    }))
  };

  try {
    await api('POST', '/venda', body);

    // Reseta por completo a interface do caixa preparando-a para um próximo atendimento
    carrinho = [];
    ['valorPago', 'buscarProduto', 'buscarClientePDV'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('descontoVenda').value = 0;
    document.getElementById('resultadoBusca').innerHTML = '';
    limparClienteSelecionadoPDV();
    atualizarCarrinho();

    alert('Venda finalizada com sucesso!');
  } catch (e) {
    alert('Erro ao finalizar venda: ' + e.message);
  }
}

/**
 * Controla as sugestões flutuantes de busca de cliente por digitação no PDV.
 */
function buscarClientesPDV() {
  const termo = document.getElementById('buscarClientePDV')?.value.toLowerCase().trim();
  const container = document.getElementById('listaSugestoesCliente');
  if (!container) return;

  if (!termo) { container.style.display = 'none'; return; }

  const filtrados = clientesCache.filter(c => c.nome.toLowerCase().includes(termo));
  if (filtrados.length === 0) {
    container.innerHTML = '<div class="sugestao-item" style="cursor:default; opacity:0.5;">Nenhum cliente cadastrado</div>';
    container.style.display = 'block';
    return;
  }

  container.innerHTML = '';
  filtrados.slice(0, 5).forEach(c => {
    const item = document.createElement('div');
    item.className = 'sugestao-item';
    item.innerText = `${c.nome} | ${formatarCPFExibicao(c.cpfCnpj)}`;
    item.onclick = () => selecionarClientePDV(c);
    container.appendChild(item);
  });
  container.style.display = 'block';
}

/**
 * Preenche os metadados do cliente selecionado da lista flutuante nos campos do carrinho.
 */
function selecionarClientePDV(c) {
  document.getElementById('vendaClienteId').value = c.id;
  document.getElementById('vendaClienteNome').value = c.nome;
  document.getElementById('vendaClienteCpf').value = formatarCPFExibicao(c.cpfCnpj);
  document.getElementById('vendaClienteTelefone').value = formatarTelefoneExibicao(c.telefone);
  document.getElementById('vendaClienteEmail').value = c.email || 'Não informado';
  document.getElementById('buscarClientePDV').value = '';
  document.getElementById('listaSugestoesCliente').style.display = 'none';
}

/**
 * Limpa os dados atrelados do cliente selecionado na interface do PDV.
 */
function limparClienteSelecionadoPDV() {
  ['vendaClienteId', 'vendaClienteNome', 'vendaClienteCpf', 'vendaClienteTelefone', 'vendaClienteEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ==========================================
// 8. MÓDULO HISTÓRICO DE VENDAS
// ==========================================

/**
 * Consulta a listagem completa ou filtrada de vendas passadas registradas no sistema.
 */
async function listarVendas() {
  const lista = document.getElementById('listaVendas');
  if (!lista) return;

  lista.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  const filtroData = document.getElementById('filtroDataVenda')?.value || '';
  const filtroPag = document.getElementById('filtroPagamentoVenda')?.value || '';

  let url = '/venda?x=1';
  if (filtroData) url += `&de=${filtroData}T00:00:00&ate=${filtroData}T23:59:59`;

  try {
    let vendas = await api('GET', url) || [];
    if (filtroPag) vendas = vendas.filter(v => v.formaPagamento === filtroPag);

    const labelPag = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito' };
    lista.innerHTML = '';

    vendas.forEach(v => {
      const data = new Date(v.dataVenda || v.data).toLocaleString('pt-BR');
      const totalValor = v.total !== undefined ? v.total : v.valorTotal;
      const itens = v.itens || v.itensVenda || [];

      lista.innerHTML += `
        <tr>
          <td>${data}</td>
          <td>${v.nomeCliente || v.clienteNome || 'Anônimo'}</td>
          <td>${itens.length > 0 ? itens.map(i => `${i.nomeProduto || i.produto || 'Item'} (${i.quantidade})`).join(', ') : '-'}</td>
          <td>${dinheiro(totalValor)}</td>
          <td>${labelPag[v.formaPagamento] || v.formaPagamento}</td>
        </tr>`;
    });

    if (vendas.length === 0) lista.innerHTML = '<tr><td colspan="5">Nenhuma venda encontrada.</td></tr>';
  } catch (e) {
    lista.innerHTML = `<tr><td colspan="5">Erro: ${e.message}</td></tr>`;
  }
}

/**
 * Limpa todos os filtros de data e forma de pagamento da tela de histórico.
 */
function limparFiltrosVendas() {
  ['filtroDataVenda', 'filtroCpfVenda', 'filtroPagamentoVenda'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  listarVendas();
}

// ==========================================
// 9. MÓDULO DASHBOARD E FLUXO DE CAIXA
// ==========================================

/**
 * Consolida as métricas básicas em tempo real para exibição nos cards numéricos do Dashboard.
 */
async function atualizarDashboard() {
  try {
    const produtos = await api('GET', '/produto') || [];
    const elTotalProd = document.getElementById('totalProdutos');
    if (elTotalProd) elTotalProd.innerText = produtos.length;

    const elTotalEstoque = document.getElementById('totalEstoque');
    if (elTotalEstoque) elTotalEstoque.innerText = produtos.reduce((s, p) => s + (p.quantidadeEstoque ?? p.quantidade ?? 0), 0);

    const hoje = new Date().toISOString().slice(0, 10);
    const vendas = await api('GET', `/venda?de=${hoje}T00:00:00&ate=${hoje}T23:59:59`) || [];

    const elVendasDia = document.getElementById('totalVendasDia');
    if (elVendasDia) elVendasDia.innerText = vendas.length;

    const elFaturamentoDia = document.getElementById('faturamentoDia');
    if (elFaturamentoDia) elFaturamentoDia.innerText = dinheiro(vendas.reduce((s, v) => s + converterParaNumero(v.total !== undefined ? v.total : v.valorTotal), 0));

    const ultimasVendas = document.getElementById('ultimasVendas');
    if (ultimasVendas) {
      ultimasVendas.innerHTML = '';
      const labelPag = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito' };

      vendas.slice(0, 5).forEach(v => {
        const data = new Date(v.dataVenda || v.data).toLocaleString('pt-BR');
        const itens = v.itens || v.itensVenda || [];
        ultimasVendas.innerHTML += `
          <tr>
            <td>${data}</td>
            <td>${v.nomeCliente || v.clienteNome || 'Anônimo'}</td>
            <td>${itens.length > 0 ? itens.map(i => `${i.nomeProduto || i.produto} (${i.quantidade})`).join(', ') : '-'}</td>
            <td>${labelPag[v.formaPagamento] || v.formaPagamento}</td>
            <td>${dinheiro(v.total !== undefined ? v.total : v.valorTotal)}</td>
          </tr>`;
      });

      if (vendas.length === 0) ultimasVendas.innerHTML = '<tr><td colspan="5">Nenhuma venda registrada hoje.</td></tr>';
    }
  } catch (e) {
    console.error('Erro ao atualizar painel do Dashboard:', e);
  }
}

/**
 * Gerencia a visibilidade das abas do menu de acordo com o status do Caixa no Redis.
 * Se o caixa estiver fechado, oculta as abas de fluxo e bloqueia acesso a elas por URL.
 */
async function atualizarCaixa() {
  try {
    const caixa = await api('GET', '/caixa/aberto').catch(() => null);
    const estaAberto = caixa && (caixa.id || caixa.Id || caixa.idCaixa || caixa.IdCaixa);

    // Atualiza o ID global de controle do Caixa
    caixaAbertoId = estaAberto ? (caixa.id || caixa.Id || caixa.idCaixa || caixa.IdCaixa) : null;

    // Definição das páginas que exigem abertura do caixa para visualização
    const linksRestritos = ['produtos.html', 'pdv.html'];

    // 1. Oculta ou exibe os botões do menu lateral dinamicamente
    const botoesMenu = document.querySelectorAll('.menu button');
    botoesMenu.forEach(btn => {
      const onclick = btn.getAttribute('onclick') || '';
      if (linksRestritos.some(link => onclick.includes(link))) {
        btn.style.display = estaAberto ? 'block' : 'none';
      }
    });

    // 2. Segurança de URL: Se tentar digitar o caminho direto com o caixa fechado, expulsa
    const path = window.location.pathname;
    const naTelaRestrita = linksRestritos.some(link => path.includes(link));

    if (!estaAberto && naTelaRestrita) {
      alert('Acesso negado: E obrigatorio abrir o caixa para acessar esta tela.');
      window.location.href = 'caixa.html';
      return;
    }

    // Atualiza painel interno físico se estiver na tela caixa.html
    const status = document.getElementById('statusCaixa');
    if (!estaAberto) {
      ['caixaDinheiro', 'caixaPix', 'caixaDebito', 'caixaCredito', 'caixaTotal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = 'R$ 0,00';
      });
      if (status) {
        status.innerText = 'Nenhum caixa aberto no momento.';
        status.style.color = 'var(--muted)';
      }
      return;
    }

    const valorInicial = converterParaNumero(caixa.valorInicial || caixa.ValorInicial || 0);
    const vendasDinheiro = converterParaNumero(caixa.totalDinheiro || caixa.TotalDinheiro || 0);
    const vendasTotais = converterParaNumero(caixa.totalGeral || caixa.TotalGeral || 0);

    const elDinheiro = document.getElementById('caixaDinheiro');
    if (elDinheiro) elDinheiro.innerText = dinheiro(vendasDinheiro + valorInicial);

    const elPix = document.getElementById('caixaPix');
    if (elPix) elPix.innerText = dinheiro(caixa.totalPix || caixa.TotalPix || 0);

    const elDebito = document.getElementById('caixaDebito');
    if (elDebito) elDebito.innerText = dinheiro(caixa.totalDebito || caixa.TotalDebito || 0);

    const elCredito = document.getElementById('caixaCredito');
    if (elCredito) elCredito.innerText = dinheiro(caixa.totalCredito || caixa.TotalCredito || 0);

    const elTotal = document.getElementById('caixaTotal');
    if (elTotal) elTotal.innerText = dinheiro(vendasTotais + valorInicial);

    if (status) {
      status.innerText = 'Caixa aberto';
      status.style.color = 'var(--green)';
    }
  } catch (e) {
    console.error('Erro na sincronia de dados de caixa:', e);
  }
}

/**
 * Abre o caixa enviando o saldo base inicial de troco para a API.
 */
async function salvarDinheiroInicial() {
  const valor = parseFloat(document.getElementById('dinheiroInicialCaixa')?.value) || 0;
  try {
    const aberto = await api('GET', '/caixa/aberto').catch(() => null);

    if (!aberto || (!aberto.id && !aberto.Id && !aberto.idCaixa && !aberto.IdCaixa)) {
      const res = await api('POST', '/caixa/abrir', valor);
      caixaAbertoId = res?.id || res?.Id || res?.idCaixa || res?.IdCaixa;

      const status = document.getElementById('statusCaixa');
      if (status) {
        status.innerText = 'Caixa aberto com sucesso!';
        status.style.color = 'var(--green)';
      }
      const input = document.getElementById('dinheiroInicialCaixa');
      if (input) input.value = '';
    } else {
      caixaAbertoId = aberto.id || aberto.Id || aberto.idCaixa || aberto.IdCaixa;
      alert('Ja existe um caixa aberto.');
    }
    await atualizarTudo(); // Recarrega os menus forçando a aparição das abas liberadas
  } catch (e) { alert(e.message); }
}

/**
 * Fecha o caixa logado e zera os IDs locais de controle.
 */
async function fecharCaixa() {
  if (!caixaAbertoId) { alert('Nenhum caixa aberto no momento.'); return; }
  if (!confirm('Deseja fechar o caixa agora?')) return;

  try {
    await api('POST', `/caixa/fechar/${caixaAbertoId}`);
    caixaAbertoId = null;

    const status = document.getElementById('statusCaixa');
    if (status) {
      status.innerText = 'Caixa fechado!';
      status.style.color = 'var(--danger)';
    }
    await atualizarTudo(); // Recarrega os menus, ocultando imediatamente as abas bloqueadas
  } catch (e) { alert(e.message); }
}

// ==========================================
// 10. RELATÓRIOS MENSAL E CONFIGURAÇÕES
// ==========================================

/**
 * Agrupa o faturamento e vendas por data e formas de pagamento gerando tabelas de relatório.
 */
async function gerarRelatorioMensal() {
  const mes = document.getElementById('mesRelatorio')?.value;
  if (!mes) { alert('Selecione um mes.'); return; }

  const [ano, m] = mes.split('-');
  const de = `${ano}-${m}-01T00:00:00`;
  const ate = `${ano}-${m}-31T23:59:59`;

  try {
    const vendas = await api('GET', `/venda?de=${de}&ate=${ate}`) || [];

    const faturamento = vendas.reduce((s, v) => s + converterParaNumero(v.total !== undefined ? v.total : v.valorTotal), 0);
    const qtdVendas = vendas.length;
    const itensVendidos = vendas.reduce((s, v) => {
      const itens = v.itens || v.itensVenda || [];
      return s + itens.reduce((t, i) => t + i.quantidade, 0);
    }, 0);

    document.getElementById('relQtdVendas').innerText = qtdVendas;
    document.getElementById('relFaturamento').innerText = dinheiro(faturamento);
    document.getElementById('relItensVendidos').innerText = itensVendidos;
    document.getElementById('relTicketMedio').innerText = dinheiro(qtdVendas ? faturamento / qtdVendas : 0);

    const formas = { dinheiro: 0, pix: 0, debito: 0, credito: 0 };
    vendas.forEach(v => {
      const val = v.total !== undefined ? v.total : v.valorTotal;
      if (formas[v.formaPagamento] !== undefined) formas[v.formaPagamento] += converterParaNumero(val);
    });

    const relPag = document.getElementById('relPagamentos');
    relPag.innerHTML = '';
    const labels = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Debito', credito: 'Credito' };
    Object.entries(formas).forEach(([k, v]) => {
      relPag.innerHTML += `<tr><td>${labels[k]}</td><td>${dinheiro(v)}</td></tr>`;
    });

    const prodMap = {};
    vendas.forEach(v => {
      const itens = v.itens || v.itensVenda || [];
      itens.forEach(i => {
        const nome = i.nomeProduto || i.produto || 'Item Desconhecido';
        if (!prodMap[nome]) prodMap[nome] = { quantidade: 0, total: 0 };
        prodMap[nome].quantidade += i.quantidade;
        const sub = i.quantidade * (i.precoUnit || i.precoUnitario || 0);
        prodMap[nome].total += converterParaNumero(sub);
      });
    });

    const relProd = document.getElementById('relProdutos');
    relProd.innerHTML = '';
    const sorted = Object.entries(prodMap).sort((a, b) => b[1].quantidade - a[1].quantidade);
    if (sorted.length === 0) {
      relProd.innerHTML = '<tr><td colspan="3">Nenhum produto vendido.</td></tr>';
    } else {
      sorted.forEach(([nome, d]) => {
        relProd.innerHTML += `<tr><td>${nome}</td><td>${d.quantidade}</td><td>${dinheiro(d.total)}</td></tr>`;
      });
    }
  } catch (e) {
    alert('Erro ao gerar relatorio: ' + e.message);
  }
}

/**
 * Salva no localStorage do navegador a preferência de paleta visual (claro/escuro).
 */
function salvarConfiguracoes() {
  const select = document.getElementById('temaSistema');
  if (select) {
    localStorage.setItem('temaSistema', select.value);
    aplicarTema();
    alert('Configuracao salva com sucesso.');
  }
}

/**
 * Ativa as classes CSS necessárias para alternância de cores de tema global do sistema.
 */
function aplicarTema() {
  const tema = localStorage.getItem('temaSistema') || 'dark';
  const select = document.getElementById('temaSistema');
  if (select) select.value = tema;
  document.body.classList.toggle('light', tema === 'light');
}

/**
 * Atualiza o relógio digital textualmente na topbar do painel.
 */
function atualizarRelogio() {
  const el = document.getElementById('dataHora');
  if (el) el.innerText = new Date().toLocaleString('pt-BR');
}

// ==========================================
// 11. MÓDULO DE FUNCIONÁRIOS
// ==========================================

/**
 * Cadastra novos colaboradores validando a permissão do usuário logado diretamente.
 */
async function salvarFuncionario() {
  const cargoUsuarioLogado = localStorage.getItem('cargo_usuario') || '';
  if (cargoUsuarioLogado.toLowerCase() !== 'gerente') {
    alert('Acesso negado: Apenas Gerentes podem cadastrar funcionarios.');
    return;
  }

  // Limpa erros anteriores
  ['erroNomeFuncionario', 'erroCpfFuncionario', 'erroTelefoneFuncionario',
    'erroEmailFuncionario', 'erroLoginFuncionario', 'erroSenhaFuncionario']
    .forEach(id => { const el = document.getElementById(id); if (el) el.innerText = ''; });

  const nome = document.getElementById('nomeFuncionario').value.trim();
  const cpfRaw = document.getElementById('cpfFuncionario').value.trim();
  const telRaw = document.getElementById('telefoneFuncionario').value.trim();
  const email = document.getElementById('emailFuncionario').value.trim();
  const login = document.getElementById('loginFuncionario').value.trim();
  const senha = document.getElementById('senhaFuncionario').value;

  let temErro = false;

  if (!nome) { document.getElementById('erroNomeFuncionario').innerText = 'Nome obrigatorio'; temErro = true; }

  const cpfLimpo = cpfRaw.replace(/\D/g, '');
  if (!cpfRaw) { document.getElementById('erroCpfFuncionario').innerText = 'CPF obrigatorio'; temErro = true; }
  else if (cpfLimpo.length !== 11) { document.getElementById('erroCpfFuncionario').innerText = 'CPF invalido'; temErro = true; }

  const telLimpo = telRaw.replace(/\D/g, '');
  if (!telRaw) { document.getElementById('erroTelefoneFuncionario').innerText = 'Telefone obrigatorio'; temErro = true; }
  else if (telLimpo.length < 10 || telLimpo.length > 11) { document.getElementById('erroTelefoneFuncionario').innerText = 'Telefone invalido'; temErro = true; }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('erroEmailFuncionario').innerText = 'E-mail invalido'; temErro = true; }

  if (!login) { document.getElementById('erroLoginFuncionario').innerText = 'Login obrigatorio'; temErro = true; }
  if (!senha) { document.getElementById('erroSenhaFuncionario').innerText = 'Senha obrigatoria'; temErro = true; }

  if (temErro) return;

  const body = {
    nome,
    cpfCnpj: cpfLimpo,
    telefone: `+55${telLimpo}`,
    email: email || null,
    cargo: 'Funcionario',
    salario: 0,
    login,
    senha
  };

  try {
    await api('POST', '/funcionario', body);
    alert('Funcionario cadastrado com sucesso!');
    ['nomeFuncionario', 'cpfFuncionario', 'telefoneFuncionario', 'emailFuncionario',
      'loginFuncionario', 'senhaFuncionario'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
  } catch (e) {
    if (e.message.toLowerCase().includes('cpf')) {
      document.getElementById('erroCpfFuncionario').innerText = 'CPF ja cadastrado';
    } else if (e.message.toLowerCase().includes('login')) {
      document.getElementById('erroLoginFuncionario').innerText = 'Login ja cadastrado';
    } else {
      alert('Erro ao cadastrar funcionario: ' + e.message);
    }
  }
}

// ==========================================
// 12. MÁSCARAS DE ENTRADA (Regex) E EVENTOS
// ==========================================

function mapearMascaraCPF(valores) {
  valores = valores.replace(/\D/g, '');
  valores = valores.replace(/(\d{3})(\d)/, '$1.$2');
  valores = valores.replace(/(\d{3})(\d)/, '$1.$2');
  valores = valores.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return valores;
}

function mapearMascaraTelefone(valores) {
  valores = valores.replace(/\D/g, '');
  valores = valores.replace(/^(\d{2})(\d)/g, '($1) $2');
  valores = valores.replace(/(\d{5})(\d)/, '$1-$2');
  return valores;
}

function formatarCPFExibicao(cpf) {
  if (!cpf) return '-';
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return cpf;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarTelefoneExibicao(tel) {
  if (!tel) return '-';
  let limpo = tel.replace(/\D/g, '');
  if (limpo.startsWith('55') && limpo.length > 2) limpo = limpo.substring(2);
  if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return tel;
}

// Vinculação de escuta de eventos para aplicação de máscaras nos inputs se presentes na tela
document.getElementById('cpfCliente')?.addEventListener('input', e => e.target.value = mapearMascaraCPF(e.target.value));
document.getElementById('telefoneCliente')?.addEventListener('input', e => e.target.value = mapearMascaraTelefone(e.target.value));
document.getElementById('cpfFuncionario')?.addEventListener('input', e => e.target.value = mapearMascaraCPF(e.target.value));
document.getElementById('telefoneFuncionario')?.addEventListener('input', e => e.target.value = mapearMascaraTelefone(e.target.value));

// Fecha a janela de autocompletar flutuante de clientes no PDV se houver clique fora da área
document.addEventListener('click', function (e) {
  const container = document.getElementById('listaSugestoesCliente');
  const input = document.getElementById('buscarClientePDV');
  if (container && e.target !== input && e.target !== container) {
    container.style.display = 'none';
  }
});