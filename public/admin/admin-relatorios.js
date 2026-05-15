const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const btnBuscarRelatorio = document.getElementById('btnBuscarRelatorio');

const totalVendido = document.getElementById('totalVendido');
const totalPedidos = document.getElementById('totalPedidos');
const ticketMedio = document.getElementById('ticketMedio');
const clientesUnicos = document.getElementById('clientesUnicos');

const totalDelivery = document.getElementById('totalDelivery');
const totalRetirada = document.getElementById('totalRetirada');

const statusPendentes = document.getElementById('statusPendentes');
const statusConcluidos = document.getElementById('statusConcluidos');
const statusCancelados = document.getElementById('statusCancelados');

const tabelaProdutosVendidos = document.getElementById('tabelaProdutosVendidos');

const tipoDetalhamento = document.getElementById('tipoDetalhamento');
const campoDetalheDia = document.getElementById('campoDetalheDia');
const campoDetalheMes = document.getElementById('campoDetalheMes');
const dataDetalhamento = document.getElementById('dataDetalhamento');
const mesDetalhamento = document.getElementById('mesDetalhamento');
const btnBuscarDetalhamento = document.getElementById('btnBuscarDetalhamento');
const tabelaDetalhamentoVendas = document.getElementById('tabelaDetalhamentoVendas');

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function getHoje() {
  return new Date().toISOString().slice(0, 10);
}

function getMesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function getPrimeiroDiaMes() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

async function carregarRelatorio() {
  try {
    const start = dataInicio.value;
    const end = dataFim.value;

    let url = '/api/admin/reports/sales';
    const params = new URLSearchParams();

    if (start) params.append('start', start);
    if (end) params.append('end', end);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    btnBuscarRelatorio.disabled = true;
    btnBuscarRelatorio.textContent = 'Carregando...';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Erro ao buscar relatório.');
    }

    const data = await response.json();

    preencherResumo(data.resumo);
    preencherModalidades(data.modalidades);
    preencherStatus(data.status);
    preencherProdutos(data.produtosMaisVendidos);

  } catch (error) {
    console.error(error);
    alert('Não foi possível carregar o relatório.');
  } finally {
    btnBuscarRelatorio.disabled = false;
    btnBuscarRelatorio.textContent = 'Buscar relatório';
  }
}

async function carregarDetalhamento() {
  try {
    const type = tipoDetalhamento.value;

    let url = '/api/admin/reports/sales-detail';
    const params = new URLSearchParams();

    params.append('type', type);

    if (type === 'day') {
      if (!dataDetalhamento.value) {
        alert('Informe a data.');
        return;
      }

      params.append('date', dataDetalhamento.value);
    }

    if (type === 'month') {
      if (!mesDetalhamento.value) {
        alert('Informe o mês.');
        return;
      }

      params.append('month', mesDetalhamento.value);
    }

    url += `?${params.toString()}`;

    btnBuscarDetalhamento.disabled = true;
    btnBuscarDetalhamento.textContent = 'Carregando...';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Erro ao buscar detalhamento.');
    }

    const data = await response.json();

    preencherDetalhamento(data.itens);

  } catch (error) {
    console.error(error);
    alert('Não foi possível carregar o detalhamento.');
  } finally {
    btnBuscarDetalhamento.disabled = false;
    btnBuscarDetalhamento.textContent = 'Buscar detalhamento';
  }
}

function preencherResumo(resumo) {
  totalVendido.textContent = formatMoney(resumo.totalVendido);
  totalPedidos.textContent = formatNumber(resumo.totalPedidos);
  ticketMedio.textContent = formatMoney(resumo.ticketMedio);
  clientesUnicos.textContent = formatNumber(resumo.clientesUnicos);
}

function preencherModalidades(modalidades) {
  totalDelivery.textContent = formatNumber(modalidades.delivery);
  totalRetirada.textContent = formatNumber(modalidades.retirada);
}

function preencherStatus(status) {
  statusPendentes.textContent = formatNumber(status.pendentes);
  statusConcluidos.textContent = formatNumber(status.concluidos);
  statusCancelados.textContent = formatNumber(status.cancelados);
}

function preencherProdutos(produtos) {
  tabelaProdutosVendidos.innerHTML = '';

  if (!produtos || produtos.length === 0) {
    tabelaProdutosVendidos.innerHTML = `
      <tr>
        <td colspan="3">Nenhum produto vendido no período.</td>
      </tr>
    `;
    return;
  }

  produtos.forEach((produto) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${produto.nome}</td>
      <td>${formatNumber(produto.quantidade)}</td>
      <td>${formatMoney(produto.total)}</td>
    `;

    tabelaProdutosVendidos.appendChild(tr);
  });
}

function preencherDetalhamento(itens) {
  tabelaDetalhamentoVendas.innerHTML = '';

  if (!itens || itens.length === 0) {
    tabelaDetalhamentoVendas.innerHTML = `
      <tr>
        <td colspan="3">Nenhuma venda encontrada para esse filtro.</td>
      </tr>
    `;
    return;
  }

  itens.forEach((item) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${item.nome}</td>
      <td>${formatNumber(item.quantidade)}</td>
      <td>${formatMoney(item.total)}</td>
    `;

    tabelaDetalhamentoVendas.appendChild(tr);
  });
}

function alternarTipoDetalhamento() {
  const type = tipoDetalhamento.value;

  if (type === 'day') {
    campoDetalheDia.style.display = 'flex';
    campoDetalheMes.style.display = 'none';
  } else {
    campoDetalheDia.style.display = 'none';
    campoDetalheMes.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  dataInicio.value = getPrimeiroDiaMes();
  dataFim.value = getHoje();

  dataDetalhamento.value = getHoje();
  mesDetalhamento.value = getMesAtual();

  alternarTipoDetalhamento();

  carregarRelatorio();
  carregarDetalhamento();
});

btnBuscarRelatorio.addEventListener('click', carregarRelatorio);
btnBuscarDetalhamento.addEventListener('click', carregarDetalhamento);
tipoDetalhamento.addEventListener('change', alternarTipoDetalhamento);