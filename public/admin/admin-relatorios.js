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

document.addEventListener('DOMContentLoaded', () => {
  dataInicio.value = getPrimeiroDiaMes();
  dataFim.value = getHoje();

  carregarRelatorio();
});

btnBuscarRelatorio.addEventListener('click', carregarRelatorio);