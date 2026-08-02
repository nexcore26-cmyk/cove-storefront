import { getDb } from '../server/db';
import { pages, pageBlocks } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function importPages() {
  const db = await getDb();

  // ─── Helper: upsert page ───────────────────────────────────────────────────
  async function upsertPage(slug: string, data: {
    titleEn: string; titleAr: string;
    descriptionEn?: string; descriptionAr?: string;
    isPublished?: boolean;
  }) {
    const existing = await db.select().from(pages).where(eq(pages.slug, slug));
    if (existing.length > 0) {
      await db.update(pages).set({
        title: data.titleEn,
        titleAr: data.titleAr ?? null,
        isPublished: data.isPublished ?? true,
      }).where(eq(pages.slug, slug));
      return existing[0].id;
    }
    const [row] = await db.insert(pages).values({
      slug,
      title: data.titleEn,
      titleAr: data.titleAr ?? null,
      isPublished: data.isPublished ?? true,
    });
    return (row as any).insertId as number;
  }

  // ─── Helper: replace blocks ────────────────────────────────────────────────
  async function setBlocks(pageId: number, blocks: any[]) {
    await db.delete(pageBlocks).where(eq(pageBlocks.pageId, pageId));
    for (let i = 0; i < blocks.length; i++) {
      await db.insert(pageBlocks).values({
        pageId,
        blockType: blocks[i].blockType,
        sortOrder: i,
        config: blocks[i].content,
        isVisible: true,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ABOUT US
  // ═══════════════════════════════════════════════════════════════════════════
  const aboutId = await upsertPage('about', {
    titleEn: 'About Us',
    titleAr: 'من نحن',
    descriptionEn: 'Learn about Cove Interior Design — our story, mission, and skills.',
    descriptionAr: 'تعرف على كوف للتصميم الداخلي — قصتنا، رسالتنا، ومهاراتنا.',
  });

  await setBlocks(aboutId, [
    {
      blockType: 'hero_slider',
      content: {
        slides: [{
          titleEn: 'About Cove Interior',
          titleAr: 'عن كوف للتصميم الداخلي',
          subtitleEn: 'Crafting spaces that inspire since 2007',
          subtitleAr: 'نصنع مساحات تُلهم منذ عام 2007',
          image: 'https://coveinterior.com/wp-content/uploads/2022/07/3-1.jpg',
          ctaTextEn: 'Our Portfolio',
          ctaTextAr: 'معرض أعمالنا',
          ctaLink: '/pages/projects',
        }],
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Our Story',
        titleAr: 'قصتنا',
        bodyEn: `<p>Life, in general, is based on different functions which overlap with each other, making all need each other, and this leads to the continuity of the life cycle, its beauty, its development, and progress.</p>
<p>We find the treatment in medicine, lines in engineering, numbers in mathematics, minerals in geology, and functions in management; Such are the colors of life. Life is a blend of colors, All of it in one box at <strong>Cove Interior Design</strong>.</p>
<p>Cove's mark was created through high efficient work in which the dream became a reality. Cove was established by a Kuwaiti designer in 2007, and he aspires to be one of the best interior and exterior design organizations in the area.</p>`,
        bodyAr: `<p>الحياة بشكل عام تقوم على وظائف مختلفة تتداخل مع بعضها البعض، مما يجعل كل منها يحتاج إلى الآخر، وهذا يؤدي إلى استمرارية دورة الحياة وجمالها وتطورها وتقدمها.</p>
<p>نجد العلاج في الطب، والخطوط في الهندسة، والأرقام في الرياضيات، والمعادن في الجيولوجيا، والوظائف في الإدارة؛ هذه هي ألوان الحياة. الحياة مزيج من الألوان، كلها في صندوق واحد في <strong>كوف للتصميم الداخلي</strong>.</p>
<p>تم إنشاء بصمة كوف من خلال عمل عالي الكفاءة حيث أصبح الحلم حقيقة. تأسست كوف على يد مصمم كويتي عام 2007، ويطمح إلى أن يكون من أفضل مؤسسات التصميم الداخلي والخارجي في المنطقة.</p>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Our Incentive',
        titleAr: 'دافعنا',
        bodyEn: `<p>Our incentive is to make all customers satisfied and happy by giving them the perfect atmosphere for their own place.</p>`,
        bodyAr: `<p>دافعنا هو جعل جميع العملاء راضين وسعداء من خلال منحهم الأجواء المثالية لمكانهم الخاص.</p>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Our Skills',
        titleAr: 'مهاراتنا',
        bodyEn: `<ul>
<li>Spacing Management.</li>
<li>Providing furniture layout with full 2D &amp; 3D details.</li>
<li>Supervise projects and follow up on the progress.</li>
<li>Create solutions for any problems that happened on the site and giving the right decision.</li>
<li>A weekly report showing results of work schedule.</li>
</ul>`,
        bodyAr: `<ul>
<li>إدارة المساحات.</li>
<li>توفير مخطط الأثاث مع تفاصيل كاملة ثنائية وثلاثية الأبعاد.</li>
<li>الإشراف على المشاريع ومتابعة التقدم.</li>
<li>إيجاد حلول لأي مشاكل تحدث في الموقع واتخاذ القرار الصحيح.</li>
<li>تقرير أسبوعي يُظهر نتائج جدول العمل.</li>
</ul>`,
      },
    },
  ]);
  console.log('✅ About Us page imported (ID:', aboutId, ')');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CLIENT SERVICES
  // ═══════════════════════════════════════════════════════════════════════════
  const servicesId = await upsertPage('client-services', {
    titleEn: 'Client Services',
    titleAr: 'الخدمات المقدمة للعملاء',
    descriptionEn: 'Interior design, supervision, furnishing, and consultancy services.',
    descriptionAr: 'خدمات التصميم الداخلي والإشراف والتأثيث والاستشارات.',
  });

  await setBlocks(servicesId, [
    {
      blockType: 'hero_slider',
      content: {
        slides: [{
          titleEn: 'Client Services',
          titleAr: 'الخدمات المقدمة للعملاء',
          subtitleEn: 'Interior design, supervision, furnishing & consultancy',
          subtitleAr: 'تصميم داخلي، إشراف، تأثيث واستشارات',
          image: 'https://coveinterior.com/wp-content/uploads/2022/07/main-2-1.jpg',
          ctaTextEn: 'Contact Us',
          ctaTextAr: 'تواصل معنا',
          ctaLink: '/pages/contact',
        }],
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'What Are Our Services?',
        titleAr: 'ما هي خدماتنا؟',
        bodyEn: `<ul>
<li>Interior design (3D shots and detailed plans/drawings).</li>
<li>Implementation supervision.</li>
<li>Furnishing.</li>
<li>Consultancy.</li>
</ul>`,
        bodyAr: `<ul>
<li>التصميم الداخلي (لقطات ثلاثية الأبعاد ومخططات تفصيلية).</li>
<li>الاشراف على التنفيذ.</li>
<li>التأثيث.</li>
<li>الاستشارات.</li>
</ul>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Design Agreement Policy',
        titleAr: 'سياسة الاتفاق في التصميم',
        bodyEn: `<p>We accept design appointments based upon one condition: after the completion of the architectural and structural plan, or on the condition that the site is on the black structure or the radical restoration (meaning the whole removal of ceilings and floors).</p>`,
        bodyAr: `<p>نستقبل مواعيد التصميم بشروط وهي بعد اعتماد المخطط المعماري والإنشائي أو أن تكون حالة الموقع على الهيكل الأسود أو الترميم الجذري (معنى الترميم الجذري هو إزالة كاملة للأسقف والارضيات).</p>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Furnishing Agreement Policy',
        titleAr: 'سياسة الاتفاق في التأثيث',
        bodyEn: `<p>We provide furnishing service that is preceded by design and supervision done by us.</p>`,
        bodyAr: `<p>نوفر خدمة التأثيث بشرط أن يسبقها التصميم والإشراف من قبلنا.</p>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Available Contract Options',
        titleAr: 'خيارات العقد المتاحة',
        bodyEn: `<p>The customer can agree on the following contracts:</p>
<ul>
<li>Design and blueprints only.</li>
<li>Furnishing service.</li>
</ul>`,
        bodyAr: `<p>بإمكان العميل الاتفاق بالعقود التالية:</p>
<ul>
<li>تصميم ومخططات فقط.</li>
<li>خدمة التأثيث.</li>
</ul>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'What Does Interior Design Include?',
        titleAr: 'ماذا يشمل التصميم الداخلي؟',
        bodyEn: `<ul>
<li>Furniture layout with measurements.</li>
<li>Sketch of electricity points (Switch, plugs, telephone, television, headphones, cameras, Internet).</li>
<li>Sketch of lighting points (floors, walls, ceilings).</li>
<li>Sketch of plumbing points (shower areas, sinks, toilets, rinsing, sanitation).</li>
<li>Detailed plans for ceilings, walls, and floors with full description of materials used.</li>
<li>Detailed plans for customized furniture.</li>
<li>Bill of Quantities (BOQ) if any.</li>
<li>Critical Path Methods (CPM) if any.</li>
<li>A hard copy of the design and plans in A3/A2 size, with a soft copy USB as reference.</li>
</ul>`,
        bodyAr: `<ul>
<li>مخطط الأثاث مع القياسات.</li>
<li>مخطط نقاط الكهرباء (سويتشات، بلاكات، تلفون، تلفزيون، سماعات، كاميرات، انترنت).</li>
<li>مخطط نقاط الإضاءة (بالأرض، الحوائط، الأسقف).</li>
<li>مخطط نقاط الصحي (أماكن الشور، المغسلة، المرحاض، الشطاف، الصرف الصحي).</li>
<li>مخططات تفصيلية للأسقف والحوائط والأرضيات مع وصف المواد المستخدمة.</li>
<li>مخططات تفصيلية لقطع أثاث تفصال.</li>
<li>جدول الكميات (BOQ).</li>
<li>نسخ من التصميم والمخططات قياس A3/A2 مع نسخة احتياطية USB.</li>
</ul>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'What Is the Critical Path Method (CPM)?',
        titleAr: 'ما هو جدول المسار الحرج (CPM)؟',
        bodyEn: `<p>It is a table/schedule showing the order of items and the steps to be implemented from the beginning of the plumbing and electricity up to the furnishing and final cleaning, showing the time frame of each part with the expected time of completion.</p>`,
        bodyAr: `<p>هو جدول يلخص كميات مواد التشطيب كاملة (بالمتر المربع، المتر الطولي، كميات القطع المطلوبة) مع وصف المواد. الفائدة من جدول الكميات يساعد العميل في شراء المواد والتسعير من قبل المقاولين.</p>`,
      },
    },
  ]);
  console.log('✅ Client Services page imported (ID:', servicesId, ')');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. COMPANY PORTFOLIO (Projects)
  // ═══════════════════════════════════════════════════════════════════════════
  const portfolioId = await upsertPage('projects', {
    titleEn: 'Company Portfolio',
    titleAr: 'معرض الأعمال',
    descriptionEn: '3D designs, real projects, and before/after comparisons.',
    descriptionAr: 'تصاميم ثلاثية الأبعاد، مشاريع حقيقية، ومقارنات قبل وبعد.',
  });

  await setBlocks(portfolioId, [
    {
      blockType: 'hero_slider',
      content: {
        slides: [{
          titleEn: 'Company Portfolio',
          titleAr: 'معرض الأعمال',
          subtitleEn: '3D designs, real projects & before/after comparisons',
          subtitleAr: 'تصاميم ثلاثية الأبعاد، مشاريع حقيقية ومقارنات',
          image: 'https://coveinterior.com/wp-content/uploads/2022/07/main-2-1.jpg',
        }],
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: '3D Design Categories',
        titleAr: 'فئات التصميم ثلاثي الأبعاد',
        bodyEn: `<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2017/06/7.jpg" alt="Bedrooms" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">Bedrooms</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/3-1.jpg" alt="Hall & Living" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">Hall & Living</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/8.png" alt="Dining Rooms" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">Dining Rooms</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/5.jpg" alt="Swimming Pools" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">Swimming Pools</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/18.jpg" alt="Toilette – Bathroom" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">Toilette – Bathroom</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/20.jpg" alt="Commercial Shops" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">Commercial Shops</span></div>
  </div>
</div>`,
        bodyAr: `<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2017/06/7.jpg" alt="غرف النوم" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">غرف النوم</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/3-1.jpg" alt="صالات الاستقبال" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">صالات الاستقبال</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/8.png" alt="غرف الطعام" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">غرف الطعام</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/5.jpg" alt="حمامات السباحة" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">حمامات السباحة</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/18.jpg" alt="حمامات" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">حمامات</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-square group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/20.jpg" alt="محلات تجارية" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-black/40 flex items-end p-4"><span class="text-white font-semibold text-lg">محلات تجارية</span></div>
  </div>
</div>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Real Projects',
        titleAr: 'المشاريع الحقيقية',
        bodyEn: `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/main-2-1.jpg" alt="Nuun" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">Nuun</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/IMG_0245.jpg" alt="Private Villa 1" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">Private Villa 1</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/main-1-1.jpg" alt="Private Villa 2" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">Private Villa 2</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/11/ASK4690-websize-1.jpg" alt="Private Villa 3" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">Private Villa 3</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2024/06/DSF3306-websize.jpg" alt="Private Villa 4" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">Private Villa 4</span></div>
  </div>
</div>`,
        bodyAr: `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/main-2-1.jpg" alt="نوون" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">نوون</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/IMG_0245.jpg" alt="فيلا خاصة 1" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">فيلا خاصة 1</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/main-1-1.jpg" alt="فيلا خاصة 2" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">فيلا خاصة 2</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/11/ASK4690-websize-1.jpg" alt="فيلا خاصة 3" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">فيلا خاصة 3</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2024/06/DSF3306-websize.jpg" alt="فيلا خاصة 4" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">فيلا خاصة 4</span></div>
  </div>
</div>`,
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: '3D vs Real — Before & After',
        titleAr: 'ثلاثي الأبعاد مقابل الحقيقي',
        bodyEn: `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/1.png" alt="Comparison 1" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">Comparison 1</span></div>
  </div>
</div>`,
        bodyAr: `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/1-feature-ar.jpg" alt="مقارنة 1" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6"><span class="text-white font-semibold text-xl">مقارنة 1</span></div>
  </div>
</div>`,
      },
    },
  ]);
  console.log('✅ Company Portfolio (projects) page imported (ID:', portfolioId, ')');

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. EVENTS
  // ═══════════════════════════════════════════════════════════════════════════
  const eventsId = await upsertPage('events', {
    titleEn: 'Events',
    titleAr: 'الفعاليات',
    descriptionEn: 'Cove Interior events, exhibitions, and media appearances.',
    descriptionAr: 'فعاليات كوف للتصميم الداخلي، المعارض والمقابلات الإعلامية.',
  });

  await setBlocks(eventsId, [
    {
      blockType: 'hero_slider',
      content: {
        slides: [{
          titleEn: 'Events',
          titleAr: 'الفعاليات',
          subtitleEn: 'Exhibitions, forums, and media appearances',
          subtitleAr: 'معارض، منتديات ومقابلات إعلامية',
          image: 'https://coveinterior.com/wp-content/uploads/2022/07/cove-events.jpg',
        }],
      },
    },
    {
      blockType: 'text_html',
      content: {
        titleEn: 'Our Events',
        titleAr: 'فعالياتنا',
        bodyEn: `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Special-Invitation-From-Hasan-Abul-Company-.jpg" alt="Special Invitation From Hasan Abul Company" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">Special Invitation From Hasan Abul Company</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Engineers-Without-Borders-Forum-.jpg" alt="Engineers Without Borders Forum" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">Engineers Without Borders Forum</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Alawatan-TV-Interview-1-2.jpg" alt="Alawatan TV Interview" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">Alawatan TV Interview</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Visitors-1.jpg" alt="Visitors" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">Visitors</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Italy-Meeting.jpg" alt="Italy Meeting" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">Italy Meeting</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Conference-in-Kuwait-2.jpg" alt="Conference in Kuwait" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">Conference in Kuwait</span></div>
  </div>
</div>`,
        bodyAr: `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Special-Invitation-From-Hasan-Abul-Company-.jpg" alt="دعوى من شركة حسن أبل" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">دعوى من شركة حسن أبل</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Engineers-Without-Borders-Forum-.jpg" alt="منتدى مهندسون بلا حدود" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">منتدى مهندسون بلا حدود</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Alawatan-TV-Interview-1-2.jpg" alt="مقابلة ملعب الوطن" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">مقابلة ملعب الوطن</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Visitors-1.jpg" alt="صور تذكارية مع شخصيات مختلفة" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">صور تذكارية مع شخصيات مختلفة</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Italy-Meeting.jpg" alt="الملتقى الإيطالي" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">الملتقى الإيطالي</span></div>
  </div>
  <div class="relative overflow-hidden rounded-lg aspect-video group cursor-pointer">
    <img src="https://coveinterior.com/wp-content/uploads/2022/07/Conference-in-Kuwait-2.jpg" alt="صور مؤتمر (الكويت)" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><span class="text-white font-semibold">صور مؤتمر (الكويت)</span></div>
  </div>
</div>`,
      },
    },
  ]);
  console.log('✅ Events page imported (ID:', eventsId, ')');

  console.log('\n🎉 All 4 pages imported successfully!');
  process.exit(0);
}

importPages().catch(e => { console.error(e); process.exit(1); });
