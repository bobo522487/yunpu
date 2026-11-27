import { formatPlacePath } from '../../place-input';
import type { ArticleDocType, ProjectArticleSeedContext } from '../types';

export interface ArticleTemplate {
  id: string;
  docType: ArticleDocType;
  name: string;
  description: string;
  defaultSubtitle: string;
  buildContent: (ctx: ProjectArticleSeedContext) => string;
}

function names(ctx: ProjectArticleSeedContext) {
  const familyName = ctx.familyName?.trim() || '本族';
  const surname = ctx.surname?.trim() || '宗';
  const hallName = ctx.hallName?.trim() || `${surname}氏宗堂`;
  const ancestor = ctx.ancestor?.trim() || `${surname}氏始迁祖`;
  const region = formatPlacePath(ctx.region, ' ') || '故里原籍';
  return { familyName, surname, hallName, ancestor, region };
}

export const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  {
    id: 'blank',
    docType: 'custom',
    name: '空白谱文',
    description: '从空段落开始撰写。',
    defaultSubtitle: '',
    buildContent: () => '<p></p>',
  },
  {
    id: 'preface',
    docType: 'preface',
    name: '重修谱序',
    description: '卷首谱序，说明修谱缘起与宗旨。',
    defaultSubtitle: '卷首 · 重修谱序',
    buildContent: (ctx) => {
      const { familyName, hallName, ancestor, region } = names(ctx);
      return `<h2>一、修谱缘起</h2>
<p>夫木有本而枝叶茂，水有源而流泽长；人有祖而后世系明，族有谱而亲疏序。吾族${familyName}，以「${hallName}」为堂号，自始迁祖${ancestor}公择居${region}以来，耕读传家，瓜瓞绵延，迄今已历数世。</p>
<blockquote><p>「盛世修志，旺族修谱。」谱牒之设，非徒纪名讳、辨昭穆而已，实欲使后世子孙知所从来，明孝悌之义，敦睦宗族之情。</p></blockquote>
<h2>二、本次重修宗旨</h2>
<p>岁月既久，旧谱残佚堪虞，加之近年宗亲迁徙四方，生卒婚配亟待续录。今由族中贤达共议，依托云谱数字修谱平台汇辑旧闻、采录新丁，务求世系清晰、传记翔实、体例谨严，俾千秋百代之后，展卷而知本源，开帙而见先风。</p>
<hr />
<p style="text-align: right">岁次重修之时 · ${hallName}谨识</p>`;
    },
  },
  {
    id: 'rules',
    docType: 'rules',
    name: '修谱凡例',
    description: '收录范围、字辈和著录体例。',
    defaultSubtitle: '卷首 · 编修体例与收录规范',
    buildContent: (ctx) => {
      const { ancestor } = names(ctx);
      return `<h2>编修总则</h2>
<ol>
  <li><p><strong>尊祖敬宗，详近略远</strong>：凡本支一脉，自${ancestor}公起为一世，依代次顺列，远祖源流则另立专篇考述，以免附会。</p></li>
  <li><p><strong>男女并录，一视同仁</strong>：新时代修谱秉持男女平等之义，凡本族子女及配偶均按实录入名讳、字辈与生平纪略。</p></li>
  <li><p><strong>秉笔直书，信以传信</strong>：生卒年月、配娶氏族、迁徙地名及葬地坟向，均以核实为准；存疑之处注明「待考」，绝不臆造。</p></li>
</ol>
<h2>字辈与体例对照示例</h2>
<table>
  <tbody>
    <tr>
      <th>项目</th>
      <th>编修规范说明</th>
      <th>著录示例</th>
    </tr>
    <tr>
      <td>名讳与字号</td>
      <td>正名居首，字、号附后，曾用名可另注</td>
      <td>讳宗文，字伯章，号竹溪</td>
    </tr>
    <tr>
      <td>生卒纪年</td>
      <td>优先采用公历，亦可并注农历与干支</td>
      <td>生于一九三二年壬申十月</td>
    </tr>
    <tr>
      <td>世次行第</td>
      <td>标明第几世及兄弟姐妹长幼排行</td>
      <td>五世 · 长子 / 次女</td>
    </tr>
  </tbody>
</table>`;
    },
  },
  {
    id: 'origin',
    docType: 'origin',
    name: '姓氏源流',
    description: '得姓与本支迁徙。',
    defaultSubtitle: '卷一 · 受姓源流与迁徙沿革',
    buildContent: (ctx) => {
      const { surname, hallName, ancestor, region } = names(ctx);
      return `<h2>一、得姓之始</h2>
<p>${surname}姓源远流长，历代郡望堂号播迁有序，本支素重「${hallName}」渊源。自上古受姓以来，历秦汉魏晋唐宋元明清各代，先祖多以礼法传家、忠信立身，散居大江南北。</p>
<h2>二、本支迁徙脉络</h2>
<p>据旧谱残卷及地方志乘所载，本支先祖自中原南渡或北迁，辗转徙居${region}。${ancestor}公相度山川形胜，见此地土沃泉甘、风俗淳厚，遂筑室定居，开基立业，是为本族一世之祖。</p>
<ul>
  <li><p><strong>立基创业期</strong>：${ancestor}公躬耕力行，兴修田庐，奠定家族生计基础。</p></li>
  <li><p><strong>分房衍派期</strong>：传至三世、四世之后，支派渐繁，分居邻邑各村落，仍岁时祭扫不辍。</p></li>
</ul>`;
    },
  },
  {
    id: 'motto',
    docType: 'motto',
    name: '祖训家规',
    description: '家训十条。',
    defaultSubtitle: '卷二 · 传家训诫',
    buildContent: () => `<blockquote><p>「积善之家，必有余庆；诗书传家，其泽乃长。」</p></blockquote>
<ol>
  <li><p><strong>孝顺父母</strong>：晨昏定省，生养死葬皆尽其诚，毋违尊长教诲。</p></li>
  <li><p><strong>友爱手足</strong>：同气连枝，患难相恤，切忌因财帛细故伤及骨肉之情。</p></li>
  <li><p><strong>敬宗睦族</strong>：凡我宗亲，无论贫富贵贱，皆一祖之遗脉，当彼此扶持。</p></li>
  <li><p><strong>崇尚诗书</strong>：无论农工商贾，皆宜督课子弟读书明理，知书则礼义自明。</p></li>
  <li><p><strong>勤俭持家</strong>：一粥一饭当思来处不易，戒奢靡，尚朴素。</p></li>
  <li><p><strong>诚信立世</strong>：言必信，行必果，商贾交易尤重仁义。</p></li>
  <li><p><strong>奉公守法</strong>：谨守国法乡约，安分守己，勿作非分之想。</p></li>
  <li><p><strong>慎终追远</strong>：清明冬至祭扫祖茔，不可怠废先人祀典。</p></li>
</ol>`,
  },
  {
    id: 'biography',
    docType: 'biography',
    name: '人物传略',
    description: '以始迁祖或所选人物起稿。P0 只用项目里的始迁祖姓名。',
    defaultSubtitle: '卷三 · 人物传记',
    buildContent: (ctx) => {
      const { ancestor, region } = names(ctx);
      return `<h2>生平概略</h2>
<p>${ancestor}公，乃本支一世始迁祖。公生性敦厚，少时勤勉好学，长而精于耕读营生。值世道迁变之际，公携眷属迁徙至${region}，披荆斩棘，兴建屋宇，敦睦乡邻，遂开本族百年基业。</p>
<h3>品行与遗泽</h3>
<p>公尝谓子孙曰：「做人以诚为本，立业以勤为先。财帛可散，惟忠厚与诗书不可废。」乡人感其德行，每有纷争多请公居间排解，皆心悦诚服而去。</p>`;
    },
  },
  {
    id: 'inscription',
    docType: 'inscription',
    name: '宗祠碑记',
    description: '碑记与艺文选存。',
    defaultSubtitle: '卷三 · 碑刻铭文与诗词选存',
    buildContent: (ctx) => {
      const { hallName } = names(ctx);
      return `<h2 style="text-align: center">${hallName}宗祠重修记</h2>
<p>维岁序更新，宗亲合力修葺祖祠。栋宇既崇，丹楹刻桷，非徒壮观瞻也，实以安先灵、聚宗情、垂典范于后昆。祠内正厅悬「${hallName}」匾额，左列昭穆世系，右刻祖训家规，凡入斯堂者，当肃然起敬，思先人之劳苦，勉今日之奋发。</p>
<hr />
<h3 style="text-align: center">宗谱告成偶成</h3>
<p style="text-align: center">一脉相承数百秋，山高水长溯源流。</p>
<p style="text-align: center">枝繁叶茂今重记，长使清芬万古留。</p>`;
    },
  },
  {
    id: 'donors',
    docType: 'custom',
    name: '捐资芳名录',
    description: '按金额或事项登录捐资族亲。',
    defaultSubtitle: '附录 · 捐资芳名',
    buildContent: (ctx) => {
      const { hallName } = names(ctx);
      return `<h2>${hallName}重修捐资芳名</h2>
<p>凡乐输资金、物资或劳务者，依实名登录，不以多寡分亲疏。</p>
<table>
  <tbody>
    <tr><th>芳名</th><th>支派</th><th>事项</th><th>金额或物资</th></tr>
    <tr><td></td><td></td><td>修祠</td><td></td></tr>
  </tbody>
</table>`;
    },
  },
];

export function getArticleTemplate(id: string): ArticleTemplate | undefined {
  return ARTICLE_TEMPLATES.find((item) => item.id === id);
}