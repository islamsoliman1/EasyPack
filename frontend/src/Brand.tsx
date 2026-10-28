import { company } from './company';
import { translateUi, useLanguage } from './i18n';

export function Brand() {
  useLanguage();
  return <div className="brand">
    <img src={company.logo} width="1449" height="1086" alt={translateUi(company.name)} />
  </div>;
}
