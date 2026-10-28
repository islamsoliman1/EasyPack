import { company } from './company';
import { translateUi, useLanguage } from './i18n';

export function CompanyDetails() {
  useLanguage();
  return <details className="company-details">
    <summary>{translateUi('معلومات الشركة')}</summary>
    <div className="company-details-body">
      <strong>{translateUi(company.name)}</strong>
      <address>
        <span>{translateUi(company.address)}</span>
        <a href={`mailto:${company.email}`} dir="ltr">{company.email}</a>
        <div className="company-links">
          {company.phones.map(phone => <a key={phone} href={`tel:${phone}`} dir="ltr">{phone}</a>)}
        </div>
      </address>
      <p>{translateUi(company.businessHours)}</p>
      <div className="company-links">
        <a href={company.catalogue} target="_blank" rel="noopener noreferrer">{translateUi('كتالوج الماكينات (PDF)')}</a>
        <a href={company.whatsapp} target="_blank" rel="noopener noreferrer">{translateUi('واتساب')}</a>
      </div>
    </div>
  </details>;
}
