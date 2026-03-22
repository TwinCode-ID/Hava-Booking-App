import { Landmark, Wallet } from "lucide-react";

export const getBankLogo = (bankName) => {
  const n = (bankName || "").toLowerCase();

  const logos = {
    bca: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg",
    mandiri:
      "https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg",
    bri: "https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg",
    bni: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Bank_BNI_Logo.png",
    bsi: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Bank_Syariah_Indonesia.svg",
    btn: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Bank_BTN_logo.svg",
    cimb: "https://upload.wikimedia.org/wikipedia/commons/3/38/CIMB_Niaga_logo.svg",
    permata:
      "https://upload.wikimedia.org/wikipedia/commons/f/ff/Permata_Bank_%282024%29.svg",
    danamon: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Danamon.svg",
    ocbc: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Logo-ocbc.svg",
    panin:
      "https://upload.wikimedia.org/wikipedia/commons/c/c9/Logo_Panin_Bank.svg",
    mega: "https://upload.wikimedia.org/wikipedia/commons/a/af/Bank_Mega_2013.svg",
    jago: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Logo-jago.svg",
    seabank: "https://upload.wikimedia.org/wikipedia/commons/a/ac/SeaBank.svg",
    blu: "https://upload.wikimedia.org/wikipedia/commons/b/bd/BCA_Digital_logo.svg",
    jenius:
      "https://upload.wikimedia.org/wikipedia/commons/8/8d/SMBC_Indonesia_logo.png",
    allo: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Allo_Bank_logo.png",
    gopay: "https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg",
    ovo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg",
    dana: "https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg",
    shopeepay: "https://upload.wikimedia.org/wikipedia/commons/f/fe/Shopee.svg",
    linkaja: "https://upload.wikimedia.org/wikipedia/commons/8/85/LinkAja.svg",
  };

  for (const [key, url] of Object.entries(logos)) {
    if (n.includes(key)) {
      return (
        <img
          src={url}
          alt={`${key} logo`}
          className='h-5 w-auto object-contain'
        />
      );
    }
  }

  // Fallback icon based on whether it sounds like a wallet or bank
  if (n.includes("pay") || n.includes("wallet")) {
    return <Wallet className='w-5 h-5 text-gray-400' />;
  }
  return <Landmark className='w-5 h-5 text-gray-400' />;
};
