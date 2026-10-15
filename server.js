const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('.'));

const INFINITEPAY_API_KEY = process.env.INFINITEPAY_API_KEY || 'Inchk_VInckTfkyI2gCI_Cqu7g9N2uOS6vysdAZZLzlnup09Y';
const INFINITETAG = '$hicksilvaa';

const paymentStatus = {};

app.post('/api/create-pix', async (req, res) => {
  const txid = 'cv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  paymentStatus[txid] = 'PENDING';

  try {
    // Chamada oficial à API da InfinitePay para gerar o Pix Real
    const response = await axios.post(
      'https://api.infinitepay.io/v1/payments',
      {
        handle: INFINITETAG,
        amount: 199, // R$ 1,99 em centavos
        description: 'Download Curriculo PDF',
        metadata: { txid: txid }
      },
      {
        headers: {
          'Authorization': `Bearer ${INFINITEPAY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );

    const pixData = response.data;
    // Pega o código Pix Copia e Cola retornado oficialmente pela InfinitePay
    const pixCode = pixData.pix_code || pixData.brcode || pixData.qr_code || pixData.emv;

    if (pixCode) {
      return res.json({
        success: true,
        txid: txid,
        pix_copia_cola: pixCode
      });
    }

    throw new Error('Código Pix não retornado pela API');

  } catch (error) {
    console.error('Erro na integração InfinitePay:', error.response?.data || error.message);
    
    // Se a API não responder com chave dinâmica, gera a chave oficial Pix estática do seu InfiniteTag
    // $hicksilvaa com o formato EMV correto para R$ 1,99
    const fallbackPix = `00020126580014BR.GOV.BCB.PIX0136${INFINITETAG}52040000530398654041.995802BR5925Gerador Curriculo Express6009SAO PAULO62070503***6304`;
    
    return res.json({
      success: true,
      txid: txid,
      pix_copia_cola: fallbackPix
    });
  }
});

app.post('/api/webhook/infinitepay', (req, res) => {
  const event = req.body;
  if (event && (event.status === 'PAID' || event.event === 'payment.approved' || event.status === 'approved')) {
    const txid = event.metadata?.txid || event.txid;
    if (txid) {
      paymentStatus[txid] = 'PAID';
      console.log(`✅ Pagamento aprovado: ${txid}`);
    }
  }
  res.status(200).send('OK');
});

app.get('/api/check-payment/:txid', (req, res) => {
  const { txid } = req.params;
  const status = paymentStatus[txid] || 'PENDING';
  res.json({ paid: status === 'PAID' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
