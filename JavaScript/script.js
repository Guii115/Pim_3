// ============================================================
//  GameShop PDV — script.js v2.0
//  Conectado à API ASP.NET em http://localhost:5280
// ============================================================

const API = 'http://localhost:5280/api';
let carrinho = [];
let produtosCache = [];
let clientesCache = [];
let caixaAbertoId = null;

const CATEGORIAS = [
  { id: 1, nome: 'Jogos Mídia Física', temPlataforma: true  },
  { id: 2, nome: 'Acessórios',         temPlataforma: true  },
  { id: 3, nome: 'Consoles',           temPlataforma: false }
];

// ── UTILITÁRIOS E CORREÇÃO DE MOEDA ─────────────────────────

function converterParaNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'string') {
    valor = valor.replace(',', '.');
  }
  const num = Number(valor);
  return isNaN(num) ? 0 : num;
}

function dinheiro(valor) {
  return converterParaNumero(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getToken() {
  return localStorage.getItem('token');
}

function getFuncionarioId() {
  return localStorage.getItem('funcionario_id');
}

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
    mostrarLogin();
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ mensagem: 'Erro desconhecido.' }));
    throw new Error(err.mensagem || 'Erro na requisição.');
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── LOGIN ────────────────────────────────────────────────────

function mostrarLogin() {
  document.getElementById('loginOverlay').style.display = 'flex';
}

function esconderLogin() {
  document.getElementById('loginOverlay').style.display = 'none';
}

async function fazerLogin() {
  const login = document.getElementById('inputLogin').value.trim();
  const senha = document.getElementById('inputSenha').value;

  if (!login || !senha) {
    document.getElementById('erroLogin').innerText = 'Preencha login e senha.';
    return;
  }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha })
    });

    if (!res.ok) {
      document.getElementById('erroLogin').innerText = 'Login ou senha inválidos.';
      return;
    }

    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('nome_usuario', data.nome);
    localStorage.setItem('cargo_usuario', data.cargo);

    const payload = JSON.parse(atob(data.token.split('.')[1]));
    localStorage.setItem('funcionario_id', payload['funcionario_id']);
    localStorage.setItem('usuario_id', payload['id'] || payload['unique_name'] || "1");

    document.getElementById('nomeUsuarioLogado').innerText = `${data.nome} (${data.cargo})`;
    esconderLogin();
    atualizarTudo();
  } catch (e) {
    document.getElementById('erroLogin').innerText = 'Erro ao conectar com o servidor.';
  }
}

async function fazerLogout() {
  await api('POST', '/auth/logout').catch(() => {});
  localStorage.clear();
  mostrarLogin();
}

// ── NAVEGAÇÃO ────────────────────────────────────────────────

function mostrarTela(id, botao) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
  botao.classList.add('active');

  const nomes = {
    dashboard: 'Dashboard', produtos: 'Produtos', clientes: 'Clientes',
    pdv: 'Frente de Caixa', vendas: 'Histórico de Vendas',
    relatorio: 'Relatório Mensal', caixa: 'Fechamento de Caixa',
    configuracoes: 'Configurações'
  };
  document.getElementById('tituloTela').innerText = nomes[id];
  atualizarTudo();
}

// ── PRODUTOS ─────────────────────────────────────────────────

function onCategoriaChange() {
  const idCategoria = parseInt(document.getElementById('categoriaProduto').value);
  const cat = CATEGORIAS.find(c => c.id === idCategoria);
  const campoPlatforma = document.getElementById('campoPlatforma');
  campoPlatforma.style.display = cat?.temPlataforma ? 'block' : 'none';
  if (!cat?.temPlataforma) {
    document.getElementById('plataformaProduto').value = '';
  }
}

async function preencherCodigoAutomatico() {
  if (document.getElementById('produtoEditando').value) return;
  try {
    const res = await api('GET', '/produto/proximo-codigo');
    if (res) document.getElementById('codigoFiscalProduto').value = res.codigo;
  } catch (_) {}
}

async function salvarProduto() {
  const fotoInput   = document.getElementById('fotoProduto');
  const editando    = document.getElementById('produtoEditando').value;
  const nome        = document.getElementById('nomeProduto').value.trim();
  const idCategoria = parseInt(document.getElementById('categoriaProduto').value);
  const plataforma  = document.getElementById('plataformaProduto').value;
  const preco       = parseFloat(document.getElementById('precoProduto').value);
  const quantidade  = parseInt(document.getElementById('quantidadeProduto').value);
  const codigoFiscal= document.getElementById('codigoFiscalProduto').value.trim();

  const cat = CATEGORIAS.find(c => c.id === idCategoria);

  if (!nome || isNaN(preco) || isNaN(quantidade) || !idCategoria) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }
  if (cat?.temPlataforma && !plataforma) {
    alert('Selecione a plataforma para esta categoria.');
    return;
  }

  const gravarProduto = async (fotoUrl) => {
    const body = {
      codigoFiscal,
      nome,
      plataforma: cat?.temPlataforma ? plataforma : null,
      preco,
      quantidade,
      fotoUrl,
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
      document.getElementById('produtoEditando').value = '';
      limparProduto();
      await listarProdutos();
      await atualizarDashboard();
    } catch (e) {
      alert('Erro ao salvar produto: ' + e.message);
    }
  };

  if (fotoInput.files.length > 0) {
    const reader = new FileReader();
    reader.onload = e => gravarProduto(e.target.result);
    reader.readAsDataURL(fotoInput.files[0]);
  } else {
    await gravarProduto(null);
  }
}

function limparProduto() {
  document.getElementById('fotoProduto').value         = '';
  document.getElementById('codigoFiscalProduto').value = '';
  document.getElementById('nomeProduto').value         = '';
  document.getElementById('categoriaProduto').value    = '';
  document.getElementById('plataformaProduto').value   = '';
  document.getElementById('precoProduto').value        = '';
  document.getElementById('quantidadeProduto').value   = '';
  document.getElementById('campoPlatforma').style.display = 'none';
  preencherCodigoAutomatico();
}

async function listarProdutos() {
  const lista = document.getElementById('listaProdutos');
  lista.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';
  try {
    const produtos = await api('GET', '/produto');
    produtosCache = produtos || [];
    lista.innerHTML = '';
    (produtos || []).forEach(p => {
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
    if (!produtos || produtos.length === 0)
      lista.innerHTML = '<tr><td colspan="8">Nenhum produto cadastrado.</td></tr>';
  } catch (e) {
    lista.innerHTML = `<tr><td colspan="8">Erro: ${e.message}</td></tr>`;
  }
}

async function editarProduto(id) {
  const p = produtosCache.find(x => x.id === id);
  if (!p) return;

  document.getElementById('produtoEditando').value      = id;
  document.getElementById('codigoFiscalProduto').value  = p.codigoFiscal || '';
  document.getElementById('nomeProduto').value          = p.nome;
  document.getElementById('categoriaProduto').value     = p.idCategoria || '';
  document.getElementById('precoProduto').value         = p.preco;
  document.getElementById('quantidadeProduto').value    = p.quantidadeEstoque ?? p.quantidade;

  onCategoriaChange();
  document.getElementById('plataformaProduto').value = p.plataforma || '';

  window.scrollTo(0, 0);
}

async function excluirProduto(id) {
  if (!confirm('Deseja excluir este produto?')) return;
  try {
    await api('DELETE', `/produto/${id}`);
    if (document.getElementById('produtoEditando').value == id) {
      document.getElementById('produtoEditando').value = '';
      limparProduto();
    }
    await listarProdutos();
    await atualizarDashboard();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
}

// ── CLIENTES ─────────────────────────────────────────────────

function limparFormularioCliente() {
  document.getElementById('clienteEditando').value = '';
  ['nomeCliente', 'cpfCliente', 'telefoneCliente', 'emailCliente'].forEach(id => {
    document.getElementById(id).value = '';
  });
  limparErrosClientes();
}

async function salvarCliente() {
  limparErrosClientes();

  const editando = document.getElementById('clienteEditando').value;
  const nome     = document.getElementById('nomeCliente').value.trim();
  const cpfRaw   = document.getElementById('cpfCliente').value.trim();
  const telRaw   = document.getElementById('telefoneCliente').value.trim();
  const email    = document.getElementById('emailCliente').value.trim();
  
  let temErro = false;

  if (!nome) {
    document.getElementById('erroNome').innerText = 'Nome obrigatório';
    temErro = true;
  }

  const cpfLimpo = cpfRaw.replace(/\D/g, "");
  if (!cpfRaw) {
    document.getElementById('erroCpf').innerText = 'CPF obrigatório';
    temErro = true;
  } else if (cpfLimpo.length !== 11) {
    document.getElementById('erroCpf').innerText = 'CPF inválido';
    temErro = true;
  }

  const telLimpo = telRaw.replace(/\D/g, "");
  if (!telRaw) {
    document.getElementById('erroTelefone').innerText = 'Telefone obrigatório';
    temErro = true;
  } else if (telLimpo.length < 10 || telLimpo.length > 11) {
    document.getElementById('erroTelefone').innerText = 'Telefone inválido';
    temErro = true;
  }

  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !regexEmail.test(email)) {
    document.getElementById('erroEmail').innerText = 'E-mail inválido';
    temErro = true;
  }

  if (temErro) return;

  const telefoneFormatado = `+55${telLimpo}`;
  const body = { 
    nome, 
    cpfCnpj: cpfLimpo, 
    telefone: telefoneFormatado, 
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
      document.getElementById('erroCpf').innerText = 'CPF já cadastrado';
    } else {
      alert('Erro ao salvar: ' + e.message);
    }
  }
}

async function listarClientes() {
  const lista = document.getElementById('listaClientes');
  lista.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    const clientes = await api('GET', '/cliente');
    clientesCache = clientes || [];
    renderizarTabelaClientes(clientesCache);
  } catch (e) {
    lista.innerHTML = `<tr><td colspan="5">Erro: ${e.message}</td></tr>`;
  }
}

function renderizarTabelaClientes(listaClientes) {
  const lista = document.getElementById('listaClientes');
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

function editarCliente(id) {
  const cliente = clientesCache.find(x => x.id === id);
  if (!cliente) return;

  document.getElementById('clienteEditando').value = id;
  document.getElementById('nomeCliente').value     = cliente.nome;
  document.getElementById('cpfCliente').value      = formatarCPFExibicao(cliente.cpfCnpj);
  document.getElementById('telefoneCliente').value = formatarTelefoneExibicao(cliente.telefone);
  document.getElementById('emailCliente').value    = cliente.email || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirCliente(id) {
  if (!confirm('Deseja realmente excluir este cliente?')) return;
  try {
    await api('DELETE', `/cliente/${id}`);
    if (document.getElementById('clienteEditando').value == id) {
      limparFormularioCliente();
    }
    alert('Cliente removido com sucesso!');
    await listarClientes();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
}

// Realiza a filtragem no cache
function filtrarClientes() {
  const termo = document.getElementById('buscarCliente').value.toLowerCase();
  const filtrados = clientesCache.filter(c => c.nome.toLowerCase().includes(termo));
  renderizarTabelaClientes(filtrados);
}

// ── PDV / CARRINHO ───────────────────────────────────────────

async function buscarProdutosPDV() {
  const termo = document.getElementById('buscarProduto').value.toLowerCase();
  const resultadoBusca = document.getElementById('resultadoBusca');
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

  if (filtrados.length === 0)
    resultadoBusca.innerHTML = '<p>Nenhum produto encontrado.</p>';
}

function adicionarCarrinho(produtoId) {
  const produto = produtosCache.find(p => p.id === produtoId);
  if (!produto) return;

  const estoque = produto.quantidadeEstoque ?? produto.quantidade;
  if (estoque <= 0) { alert('Produto sem estoque.'); return; }

  const item = carrinho.find(i => i.idProduto === produtoId);
  if (item) {
    if (item.quantidade >= estoque) { alert('Quantidade maior que o estoque.'); return; }
    item.quantidade++;
  } else {
    carrinho.push({
      idProduto: produtoId,
      nome: produto.nome,
      preco: produto.preco,
      quantidade: 1,
      codigoFiscal: produto.codigoFiscal || ''
    });
  }
  atualizarCarrinho();
}

function atualizarCarrinho() {
  const itensCarrinho = document.getElementById('itensCarrinho');
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

  const desconto = parseFloat(document.getElementById('descontoVenda').value) || 0;
  const total    = Math.max(subtotal - desconto, 0);
  const pago     = parseFloat(document.getElementById('valorPago').value) || 0;
  const forma    = document.getElementById('formaPagamento').value;

  document.getElementById('totalCarrinho').innerText = dinheiro(total);
  document.getElementById('trocoVenda').innerText    =
    forma === 'dinheiro' ? dinheiro(Math.max(pago - total, 0)) : 'R$ 0,00';
}

function removerCarrinho(i) {
  carrinho.splice(i, 1);
  atualizarCarrinho();
}

async function finalizarVenda() {
  if (carrinho.length === 0) { alert('Carrinho vazio.'); return; }

  const idClienteStr = document.getElementById('vendaClienteId').value;
  const desconto = parseFloat(document.getElementById('descontoVenda').value) || 0;
  const formaPag = document.getElementById('formaPagamento').value;
  const valorPago= parseFloat(document.getElementById('valorPago').value) || null;

  const idCliente = idClienteStr ? parseInt(idClienteStr) : null;

  const idUsuarioStr = localStorage.getItem('usuario_id') || "1";
  const idFuncionarioStr = localStorage.getItem('funcionario_id') || "1";
  
  const idUsuario = parseInt(idUsuarioStr);
  const idFuncionario = parseInt(idFuncionarioStr);

  let totalVenda = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
  totalVenda = Math.max(totalVenda - desconto, 0);

  const body = {
    idCliente: idCliente,
    IdCliente: idCliente,
    idUsuario: idUsuario,
    IdUsuario: idUsuario,
    idFuncionario: idFuncionario,
    IdFuncionario: idFuncionario,
    desconto: desconto,
    Desconto: desconto,
    formaPagamento: formaPag,
    FormaPagamento: formaPag,
    valorPago: valorPago,
    ValorPago: valorPago,
    total: totalVenda,
    Total: totalVenda,
    itens: carrinho.map(i => ({ 
      idProduto: i.idProduto, 
      IdProduto: i.idProduto,
      quantidade: i.quantidade,
      Quantidade: i.quantidade,
      precoUnitario: i.preco,
      PrecoUnitario: i.preco
    }))
  };

  try {
    await api('POST', '/venda', body);
    carrinho = [];
    ['valorPago', 'buscarProduto', 'buscarClientePDV'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('descontoVenda').value = 0;
    document.getElementById('resultadoBusca').innerHTML = '';
    
    limparClienteSelecionadoPDV();
    atualizarCarrinho();
    await atualizarTudo();
    alert('Venda finalizada com sucesso!');
  } catch (e) {
    alert('Erro ao finalizar venda: ' + e.message);
  }
}

// ── HISTÓRICO DE VENDAS ──────────────────────────────────────

async function listarVendas() {
  const lista         = document.getElementById('listaVendas');
  const ultimasVendas = document.getElementById('ultimasVendas');
  lista.innerHTML     = '<tr><td colspan="5">Carregando...</td></tr>';

  const filtroData = document.getElementById('filtroDataVenda')?.value || '';
  const filtroPag  = document.getElementById('filtroPagamentoVenda')?.value || '';

  let url = '/venda?x=1';
  if (filtroData) url += `&de=${filtroData}T00:00:00&ate=${filtroData}T23:59:59`;

  try {
    let vendas = await api('GET', url) || [];

    if (filtroPag) vendas = vendas.filter(v => v.formaPagamento === filtroPag);

    const labelPag = { dinheiro:'Dinheiro', pix:'Pix', debito:'Débito', credito:'Crédito' };

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
    if (vendas.length === 0)
      lista.innerHTML = '<tr><td colspan="5">Nenhuma venda encontrada.</td></tr>';

    ultimasVendas.innerHTML = '';
    vendas.slice(0, 5).forEach(v => {
      const data = new Date(v.dataVenda || v.data).toLocaleString('pt-BR');
      const totalValor = v.total !== undefined ? v.total : v.valorTotal;
      const itens = v.itens || v.itensVenda || [];

      ultimasVendas.innerHTML += `
        <tr>
          <td>${data}</td>
          <td>${v.nomeCliente || v.clienteNome || 'Anônimo'}</td>
          <td>${itens.length > 0 ? itens.map(i => `${i.nomeProduto || i.produto || 'Item'} (${i.quantidade})`).join(', ') : '-'}</td>
          <td>${labelPag[v.formaPagamento] || v.formaPagamento}</td>
          <td>${dinheiro(totalValor)}</td>
        </tr>`;
    });
    if (vendas.length === 0)
      ultimasVendas.innerHTML = '<tr><td colspan="5">Nenhuma venda registrada.</td></tr>';

  } catch (e) {
    lista.innerHTML = `<tr><td colspan="5">Erro: ${e.message}</td></tr>`;
  }
}

function limparFiltrosVendas() {
  document.getElementById('filtroDataVenda').value      = '';
  document.getElementById('filtroCpfVenda').value       = '';
  document.getElementById('filtroPagamentoVenda').value = '';
  listarVendas();
}

// ── DASHBOARD ────────────────────────────────────────────────

async function atualizarDashboard() {
  try {
    const produtos = await api('GET', '/produto') || [];
    produtosCache  = produtos;
    document.getElementById('totalProdutos').innerText = produtos.length;
    document.getElementById('totalEstoque').innerText =
      produtos.reduce((s, p) => s + (p.quantidadeEstoque ?? p.quantidade ?? 0), 0);

    const hoje  = new Date().toISOString().slice(0, 10);
    const vendas= await api('GET', `/venda?de=${hoje}T00:00:00&ate=${hoje}T23:59:59`) || [];
    document.getElementById('totalVendasDia').innerText = vendas.length;
    
    document.getElementById('faturamentoDia').innerText =
      dinheiro(vendas.reduce((s, v) => {
        const val = v.total !== undefined ? v.total : v.valorTotal;
        return s + converterParaNumero(val);
      }, 0));
  } catch (_) {}
}

// ── CAIXA ────────────────────────────────────────────────────

async function salvarDinheiroInicial() {
  const valor = parseFloat(document.getElementById('dinheiroInicialCaixa').value) || 0;
  try {
    const aberto = await api('GET', '/caixa/aberto').catch(() => null);
    
    // O segredo está aqui: A API retorna { mensagem: "Nenhum caixa aberto" }
    // Se a propriedade 'id' não existir, sabemos que está fechado e podemos abrir!
    if (!aberto || (!aberto.id && !aberto.Id && !aberto.idCaixa && !aberto.IdCaixa)) {
      
      const res = await api('POST', '/caixa/abrir', valor);
      caixaAbertoId = res?.id || res?.Id || res?.idCaixa || res?.IdCaixa;
      document.getElementById('statusCaixa').innerText = '✅ Caixa aberto com sucesso!';
      
    } else {
      caixaAbertoId = aberto.id || aberto.Id || aberto.idCaixa || aberto.IdCaixa;
      document.getElementById('statusCaixa').innerText = '⚠️ Já existe um caixa aberto.';
    }
    await atualizarCaixa();
  } catch (e) {
    alert(e.message);
  }
}

async function fecharCaixa() {
  if (!caixaAbertoId) {
    const aberto = await api('GET', '/caixa/aberto').catch(() => null);
    if (!aberto || (!aberto.id && !aberto.Id && !aberto.idCaixa && !aberto.IdCaixa)) { 
        alert('Nenhum caixa aberto no momento.'); 
        return; 
    }
    caixaAbertoId = aberto.id || aberto.Id || aberto.idCaixa || aberto.IdCaixa;
  }

  if (!caixaAbertoId) {
    alert('Erro interno: O ID do Caixa não foi encontrado.');
    return;
  }

  if (!confirm('Deseja fechar o caixa agora?')) return;
  
  try {
    const caixa = await api('POST', `/caixa/fechar/${caixaAbertoId}`);
    caixaAbertoId = null;
    document.getElementById('statusCaixa').innerText = '🔒 Caixa fechado!';
    
    if (caixa) {
      // 🌟 MÁGICA AQUI: Soma o Troco (Valor Inicial) com as vendas em Dinheiro e no Total
      const valorInicial = caixa.valorInicial || caixa.ValorInicial || 0;
      const vendasDinheiro = caixa.totalDinheiro || caixa.TotalDinheiro || 0;
      const vendasTotais = caixa.totalGeral || caixa.TotalGeral || 0;

      document.getElementById('caixaDinheiro').innerText = dinheiro(vendasDinheiro + valorInicial);
      document.getElementById('caixaPix').innerText      = dinheiro(caixa.totalPix || caixa.TotalPix || 0);
      document.getElementById('caixaDebito').innerText   = dinheiro(caixa.totalDebito || caixa.TotalDebito || 0);
      document.getElementById('caixaCredito').innerText  = dinheiro(caixa.totalCredito || caixa.TotalCredito || 0);
      document.getElementById('caixaTotal').innerText    = dinheiro(vendasTotais + valorInicial);
    }
  } catch (e) {
    alert(e.message);
  }
}

async function atualizarCaixa() {
  try {
    const caixa = await api('GET', '/caixa/aberto').catch(() => null);
    
    if (!caixa || (!caixa.id && !caixa.Id && !caixa.idCaixa && !caixa.IdCaixa)) {
      ['caixaDinheiro','caixaPix','caixaDebito','caixaCredito','caixaTotal'].forEach(id => {
        document.getElementById(id).innerText = 'R$ 0,00';
      });
      document.getElementById('statusCaixa').innerText = '';
      return;
    }
    
    caixaAbertoId = caixa.id || caixa.Id || caixa.idCaixa || caixa.IdCaixa;
    
    // 🌟 MÁGICA AQUI: Mesma soma de Vendas em tempo real + Troco (Valor Inicial)
    const valorInicial = caixa.valorInicial || caixa.ValorInicial || 0;
    const vendasDinheiro = caixa.totalDinheiro || caixa.TotalDinheiro || 0;
    const vendasTotais = caixa.totalGeral || caixa.TotalGeral || 0;

    document.getElementById('caixaDinheiro').innerText = dinheiro(vendasDinheiro + valorInicial);
    document.getElementById('caixaPix').innerText      = dinheiro(caixa.totalPix || caixa.TotalPix || 0);
    document.getElementById('caixaDebito').innerText   = dinheiro(caixa.totalDebito || caixa.TotalDebito || 0);
    document.getElementById('caixaCredito').innerText  = dinheiro(caixa.totalCredito || caixa.TotalCredito || 0);
    document.getElementById('caixaTotal').innerText    = dinheiro(vendasTotais + valorInicial);
    document.getElementById('statusCaixa').innerText   = '✅ Caixa aberto';
    
  } catch (_) {}
}

// ── RELATÓRIO ────────────────────────────────────────────────

async function gerarRelatorioMensal() {
  const mes = document.getElementById('mesRelatorio').value;
  if (!mes) { alert('Selecione um mês.'); return; }

  const [ano, m] = mes.split('-');
  const de  = `${ano}-${m}-01T00:00:00`;
  const ate = `${ano}-${m}-31T23:59:59`;

  try {
    const vendas = await api('GET', `/venda?de=${de}&ate=${ate}`) || [];

    const faturamento = vendas.reduce((s, v) => {
      const val = v.total !== undefined ? v.total : v.valorTotal;
      return s + converterParaNumero(val);
    }, 0);
    
    const qtdVendas = vendas.length;
    const itensVendidos = vendas.reduce((s, v) => {
      const itens = v.itens || v.itensVenda || [];
      return s + itens.reduce((t, i) => t + i.quantidade, 0);
    }, 0);

    document.getElementById('relQtdVendas').innerText     = qtdVendas;
    document.getElementById('relFaturamento').innerText   = dinheiro(faturamento);
    document.getElementById('relItensVendidos').innerText = itensVendidos;
    document.getElementById('relTicketMedio').innerText   = dinheiro(qtdVendas ? faturamento / qtdVendas : 0);

    const formas = { dinheiro: 0, pix: 0, debito: 0, credito: 0 };
    vendas.forEach(v => {
      const val = v.total !== undefined ? v.total : v.valorTotal;
      if (formas[v.formaPagamento] !== undefined)
        formas[v.formaPagamento] += converterParaNumero(val);
    });
    
    const relPag = document.getElementById('relPagamentos');
    relPag.innerHTML = '';
    const labels = { dinheiro:'Dinheiro', pix:'Pix', debito:'Débito', credito:'Crédito' };
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
        const sub = i.subtotal !== undefined ? i.subtotal : (i.quantidade * (i.precoUnit || i.precoUnitario || 0));
        prodMap[nome].total += converterParaNumero(sub);
      });
    });

    const relProd = document.getElementById('relProdutos');
    relProd.innerHTML = '';
    const sorted = Object.entries(prodMap).sort((a,b) => b[1].quantidade - a[1].quantidade);
    if (sorted.length === 0) {
      relProd.innerHTML = '<tr><td colspan="3">Nenhum produto vendido.</td></tr>';
    } else {
      sorted.forEach(([nome, d]) => {
        relProd.innerHTML += `<tr><td>${nome}</td><td>${d.quantidade}</td><td>${dinheiro(d.total)}</td></tr>`;
      });
    }
  } catch (e) {
    alert('Erro ao gerar relatório: ' + e.message);
  }
}

// ── CONFIGURAÇÕES ────────────────────────────────────────────

function salvarConfiguracoes() {
  const tema = document.getElementById('temaSistema').value;
  localStorage.setItem('temaSistema', tema);
  aplicarTema();
  alert('Configuração salva com sucesso.');
}

function aplicarTema() {
  const tema = localStorage.getItem('temaSistema') || 'dark';
  document.getElementById('temaSistema').value = tema;
  document.body.classList.toggle('light', tema === 'light');
}

// ── ATUALIZAR TUDO ───────────────────────────────────────────

async function atualizarTudo() {
  if (!getToken()) return;

  const cargo = localStorage.getItem('cargo_usuario') || '';
  const btnFunc = document.getElementById('btnMenuFuncionarios');
  if (btnFunc) {
    if (cargo.toLowerCase() === 'gerente') {
      btnFunc.style.display = 'block';
    } else {
      btnFunc.style.display = 'none';
    }
  }

  await Promise.allSettled([
    atualizarDashboard(),
    listarProdutos(),
    listarClientes(),
    listarVendas(),
    atualizarCaixa()
  ]);
}

function atualizarRelogio() {
  document.getElementById('dataHora').innerText = new Date().toLocaleString('pt-BR');
}

// ── TIMER DE INATIVIDADE ─────────────────────────────────────

let timerInatividade = null;

function resetarTimerInatividade() {
  const cargo = localStorage.getItem('cargo_usuario');
  if (!cargo || cargo.toLowerCase() === 'gerente') return;

  clearTimeout(timerInatividade);
  timerInatividade = setTimeout(() => {
    alert('Sessão encerrada por inatividade.');
    fazerLogout();
  }, 5 * 60 * 1000);
}

['click', 'keydown', 'mousemove', 'touchstart'].forEach(evento => {
  document.addEventListener(evento, resetarTimerInatividade);
});

// ── INIT ─────────────────────────────────────────────────────

document.getElementById('descontoVenda').addEventListener('input', atualizarCarrinho);
document.getElementById('valorPago').addEventListener('input', atualizarCarrinho);
document.getElementById('formaPagamento').addEventListener('change', atualizarCarrinho);

setInterval(atualizarRelogio, 1000);
aplicarTema();
atualizarRelogio();

if (getToken()) {
  document.getElementById('nomeUsuarioLogado').innerText =
    `${localStorage.getItem('nome_usuario')} (${localStorage.getItem('cargo_usuario')})`;
  esconderLogin();
  atualizarTudo();
  preencherCodigoAutomatico();
} else {
  mostrarLogin();
}

// ── MÁSCARAS E AUXILIARES EM JAVASCRIPT PURO ────────────────────────

function limparErrosClientes() {
  const camposErro = ['erroNome', 'erroCpf', 'erroTelefone', 'erroEmail'];
  camposErro.forEach(id => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.innerText = '';
  });
}

function mapearMascaraCPF(valores) {
  valores = valores.replace(/\D/g, "");
  valores = valores.replace(/(\d{3})(\d)/, "$1.$2");
  valores = valores.replace(/(\d{3})(\d)/, "$1.$2");
  valores = valores.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return valores;
}

function mapearMascaraTelefone(valores) {
  valores = valores.replace(/\D/g, "");
  valores = valores.replace(/^(\d{2})(\d)/g, "($1) $2");
  valores = valores.replace(/(\d{5})(\d)/, "$1-$2");
  return valores;
}

document.getElementById('cpfCliente').addEventListener('input', function(e) {
  e.target.value = mapearMascaraCPF(e.target.value);
});

document.getElementById('telefoneCliente').addEventListener('input', function(e) {
  e.target.value = mapearMascaraTelefone(e.target.value);
});

function formatarCPFExibicao(cpf) {
  if (!cpf) return '-';
  const limpo = cpf.replace(/\D/g, "");
  if (limpo.length !== 11) return cpf;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatarTelefoneExibicao(tel) {
  if (!tel) return '-';
  let limpo = tel.replace(/\D/g, "");
  if (limpo.startsWith("55") && limpo.length > 2) {
    limpo = limpo.substring(2);
  }
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return tel;
}

function buscarClientesPDV() {
  const termo = document.getElementById('buscarClientePDV').value.toLowerCase().trim();
  const container = document.getElementById('listaSugestoesCliente');
  
  if (!termo) {
    container.style.display = 'none';
    return;
  }

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

function selecionarClientePDV(c) {
  document.getElementById('vendaClienteId').value       = c.id;
  document.getElementById('vendaClienteNome').value     = c.nome;
  document.getElementById('vendaClienteCpf').value      = formatarCPFExibicao(c.cpfCnpj);
  document.getElementById('vendaClienteTelefone').value = formatarTelefoneExibicao(c.telefone);
  document.getElementById('vendaClienteEmail').value    = c.email || 'Não informado';

  document.getElementById('buscarClientePDV').value = '';
  document.getElementById('listaSugestoesCliente').style.display = 'none';
}

function limparClienteSelecionadoPDV() {
  document.getElementById('vendaClienteId').value       = '';
  document.getElementById('vendaClienteNome').value     = '';
  document.getElementById('vendaClienteCpf').value      = '';
  document.getElementById('vendaClienteTelefone').value = '';
  document.getElementById('vendaClienteEmail').value    = '';
}

document.addEventListener('click', function(e) {
  const container = document.getElementById('listaSugestoesCliente');
  const input = document.getElementById('buscarClientePDV');
  if (e.target !== input && e.target !== container) {
    if (container) container.style.display = 'none';
  }
});

document.getElementById('cpfFuncionario')?.addEventListener('input', function(e) {
  e.target.value = mapearMascaraCPF(e.target.value);
});
document.getElementById('telefoneFuncionario')?.addEventListener('input', function(e) {
  e.target.value = mapearMascaraTelefone(e.target.value);
});

async function salvarFuncionario() {
  const cargoUsuarioLogado = localStorage.getItem('cargo_usuario') || '';
  if (cargoUsuarioLogado.toLowerCase() !== 'gerente') {
    alert('Erro: Apenas usuários com cargo de Gerente podem cadastrar funcionários.');
    return;
  }

  const nome = document.getElementById('nomeFuncionario').value.trim();
  const cpfRaw = document.getElementById('cpfFuncionario').value.trim();
  const telefoneRaw = document.getElementById('telefoneFuncionario').value.trim();
  const email = document.getElementById('emailFuncionario').value.trim();
  const cargo = document.getElementById('cargoFuncionario').value.trim();
  const salario = parseFloat(document.getElementById('salarioFuncionario').value);
  const login = document.getElementById('loginFuncionario').value.trim();
  const senha = document.getElementById('senhaFuncionario').value;

  if (!nome || !cpfRaw || !telefoneRaw || !cargo || isNaN(salario) || !login || !senha) {
    alert('Por favor, preencha todos os campos obrigatórios.');
    return;
  }

  const body = {
    nome,
    cpfCnpj: cpfRaw.replace(/\D/g, ""),
    telefone: `+55${telefoneRaw.replace(/\D/g, "")}`,
    email: email || null,
    cargo,
    salario,
    login,
    senha
  };

  try {
    await api('POST', '/funcionario', body);
    alert('Funcionário e usuário cadastrados com sucesso!');
    
    ['nomeFuncionario','cpfFuncionario','telefoneFuncionario','emailFuncionario',
     'cargoFuncionario','salarioFuncionario','loginFuncionario','senhaFuncionario'].forEach(id => {
      document.getElementById(id).value = '';
    });
  } catch (e) {
    alert('Erro ao cadastrar funcionário: ' + e.message);
  }
}