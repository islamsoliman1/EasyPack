// Public company details checked against easypackegypt.com on 2026-10-28.
// Source links and asset provenance: docs/COMPANY_BRAND.md.
export const company = {
  name: 'إيزي باك لماكينات التعبئة والتغليف',
  website: 'https://easypackegypt.com/',
  websiteLabel: 'easypackegypt.com',
  logo: `${import.meta.env.BASE_URL}assets/brand/easypack-symbol.png`,
  email: 'info@easypackegypt.com',
  phones: ['+201032432477', '+201018146662'],
  address: 'المنطقة الصناعية C8، العاشر من رمضان، مصر',
  businessHours: 'السبت – الخميس: 8 صباحًا – 5 مساءً. الجمعة: مغلق.',
  timeZone: 'Africa/Cairo',
  catalogue: 'https://easypackegypt.com/wp-content/uploads/2025/11/Easy-Pack-Filling-and-Packaging-Machines-Catalog.pdf',
  whatsapp: 'https://wa.me/201032432477',
  social: {
    facebook: 'https://www.facebook.com/easypackegypt',
    youtube: 'https://www.youtube.com/channel/UCYj4QDtb8PTX6LJXsXIWGyQ',
    x: 'https://x.com/EasyPackEG',
  },
} as const;
