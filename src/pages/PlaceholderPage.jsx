import { ArrowUpRight, Construction } from 'lucide-react';
import { placeholderIcon } from '../data/navigation.js';

export default function PlaceholderPage({ page }) {
  const PageIcon = placeholderIcon[page.label] ?? Construction;
  return <section className="module-page">
    <div className="module-breadcrumb">WORKSPACE <span>/</span> {page.label.toUpperCase()}</div>
    <div className="module-card"><span className="module-icon"><PageIcon size={25} strokeWidth={1.7} /></span><span className="module-status">COMING IN A FUTURE PHASE</span><h2>{page.label}</h2><p>{page.description}</p><div className="module-rule" /><div className="module-foot"><span>This section is a UI preview. No records are stored or changed.</span><span className="module-demo-pill">PREVIEW</span></div></div>
    <div className="module-tip"><ArrowUpRight size={15} /><span>Use the sidebar to preview the other SmartWater sections.</span></div>
  </section>;
}
