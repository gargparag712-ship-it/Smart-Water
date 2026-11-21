import { Activity, ArrowDownRight, ArrowUpRight, Boxes, CircleDollarSign, Minus, Package, TriangleAlert, Wrench } from 'lucide-react';

const icons = { assets: Boxes, active: Activity, inventory: Package, stock: TriangleAlert, maintenance: Wrench, expenses: CircleDollarSign };

export default function SummaryCards({ cards }) {
  return (
    <section className="summary-grid" aria-label="Scheme summary">
      {cards.map((card) => {
        const Icon = icons[card.icon];
        const improving = card.change.includes('below') || card.change.includes('Stable');
        const neutral = card.change.includes('updated') || card.source === 'live';
        const TrendIcon = neutral ? Minus : improving ? ArrowDownRight : ArrowUpRight;
        return <article className={`summary-card tone-${card.tone}`} key={card.label}>
          <div className="summary-card-top"><span className="summary-icon"><Icon size={17} strokeWidth={1.9} /></span><span className="summary-label">{card.label}</span><span className={`summary-source ${card.source}`}>{card.source === 'live' ? 'LIVE' : 'DEMO'}</span></div>
          <div className="summary-value">{card.value}</div>
          <div className="summary-bottom"><span className="summary-detail">{card.detail}</span><span className={`summary-change${improving ? ' positive' : neutral ? ' neutral' : ' attention'}`}><TrendIcon size={12} />{card.change}</span></div>
        </article>;
      })}
    </section>
  );
}
