document.addEventListener('DOMContentLoaded', ()=>{
  const walletAmount = document.getElementById('walletAmount');
  const addAmount = document.getElementById('addAmount');
  const addBtn = document.getElementById('addBtn');
  const clearBtn = document.getElementById('clearBtn');
  const cardForm = document.getElementById('cardForm');
  const cardName = document.getElementById('cardName');
  const cardNumber = document.getElementById('cardNumber');
  const cardExpiry = document.getElementById('cardExpiry');
  const cardCVC = document.getElementById('cardCVC');

  function getBalance(){
    try{ const raw = localStorage.getItem('wallet'); const w = raw ? JSON.parse(raw) : { balance: 0 }; return Number(w.balance) || 0; }catch(e){ return 0; }
  }
  function setBalance(n){ localStorage.setItem('wallet', JSON.stringify({ balance: Number(n) })); window.dispatchEvent(new Event('wallet-updated')); }

  function refresh(){ walletAmount.textContent = '$' + getBalance().toFixed(2); }

  addBtn.addEventListener('click', ()=>{
    const v = Number(addAmount.value);
    if(!v || v <= 0){ alert('Enter a positive amount'); return; }
    const bal = getBalance();
    setBalance(bal + v);
    addAmount.value = '';
    refresh();
    alert('Added $' + v.toFixed(2) + ' to wallet');
  });

  // Basic card form handling (demo only — no real payment processing)
  if(cardForm){
    cardForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const amt = Number(addAmount.value);
      if(!amt || amt <= 0){ alert('Enter an amount above before paying with card'); return; }
      // basic normalization
      const num = (cardNumber.value || '').replace(/\s+/g,'');
      const cvc = (cardCVC.value || '').trim();
      const name = (cardName.value || '').trim();
      const exp = (cardExpiry.value || '').trim();
      if(!name || num.length < 12 || cvc.length < 3 || exp.length < 3){ alert('Enter valid card details (demo validation)'); return; }
      // simulate processing
      addBtn.disabled = true;
      addBtn.textContent = 'Processing...';
      setTimeout(()=>{
        const bal = getBalance();
        setBalance(bal + amt);
        refresh();
        addAmount.value = '';
        cardForm.reset();
        addBtn.disabled = false;
        addBtn.textContent = 'Add Funds';
        alert('Payment simulated: added $' + amt.toFixed(2) + ' (demo)');
      }, 900);
    });
  }

  clearBtn.addEventListener('click', ()=>{
    if(!confirm('Clear wallet balance?')) return;
    setBalance(0);
    refresh();
  });

  refresh();
});
