# ذاكرلي — Zakerly

مساعد مذاكرة ذكي (تطبيق ويب يتثبّت على الموبايل والكمبيوتر — PWA) بالعربي والإنجليزي، وفيه وضع فاتح وداكن.

الطالب يضيف المادة من **PDF** أو **يصوّر بالكاميرا** أو **صور** أو **نص**، ويستخدم مفتاح Claude بتاعه في:
ملخصات (مختصر / مفصّل / نقاط / ليلة الامتحان) · أسئلة متوقعة بإجابات نموذجية · اختبار تفاعلي بالدرجة · بطاقات مراجعة بالتكرار المتباعد · "اشرحلي ببساطة" · المصطلحات · خريطة ذهنية · دردشة مع الدرس · قراءة بصوت · طباعة/PDF.
وكمان: جلسات تركيز (بومودورو)، هدف يومي، أيام متتالية.

**نموذج الربح:** 3 أيام مجاناً، بعدها اشتراك مدى الحياة بـ 100 جنيه (الدفع عن طريق Paymob). السعر وعدد أيام الفترة المجانية بيتغيّروا من **صفحة صاحب التطبيق** (`#/owner`).

> تكلفة الـ AI على الطالب نفسه (بيحط مفتاح Claude بتاعه من الإعدادات، والمفتاح بيفضل على جهازه بس).

---

## التشغيل محلياً

```bash
npm install
npm run dev
```

من غير إعداد Supabase التطبيق بيشتغل مجاني بالكامل (مفيد للتجربة). عشان تفعّل الحسابات والدفع اعمل الخطوات اللي تحت وحط القيم في `.env` (شوف `.env.example`).

---

## الإعداد الكامل (مرة واحدة)

### 1) Supabase (الحسابات + الاشتراكات + السعر)

1. اعمل مشروع مجاني على [supabase.com](https://supabase.com).
2. من **SQL Editor** شغّل محتوى الملف `supabase/migrations/0001_billing.sql`.
3. **Authentication → Providers → Email**: خليه مفعّل.
4. **Authentication → Email Templates → Magic Link**: حط الكود في الرسالة، مثلاً:
   ```html
   <h2>كود الدخول لذاكرلي</h2>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   ```
   (الطالب بيدخل بكود 6 أرقام بيوصله على الإيميل، من غير باسورد.)
5. من **Project Settings → API** خد `Project URL` و `anon public key`، وحطهم في `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY`.

### 2) خلّي نفسك صاحب التطبيق

سجّل دخول في التطبيق بإيميلك مرة، وبعدها شغّل في SQL Editor:

```sql
update public.profiles set is_admin = true where email = 'your@email.com';
```

هتلاقي «صفحة صاحب التطبيق» في القائمة وفي الإعدادات. منها بتعمل الآتي:
- تغيّر السعر (الافتراضي 100 جنيه) وعدد أيام الفترة المجانية.
- تشوف عدد المستخدمين واللي في الفترة المجانية والمشتركين وإجمالي الإيرادات.
- تفعّل اشتراك لطالب بنفسك (لو دفعلك كاش أو إنستاباي) أو تلغيه.

### 3) Paymob (استقبال الدفع)

1. اعمل حساب تاجر على [paymob.com](https://paymob.com)، وفعّل طرق الدفع اللي عايزها (كروت، محافظ…).
2. من لوحة Paymob خد: **Secret Key** و **Public Key** و **HMAC Secret** و **Integration IDs** لطرق الدفع.
3. ثبّت [Supabase CLI](https://supabase.com/docs/guides/cli) وبعدها:
   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase secrets set \
     PAYMOB_SECRET_KEY=... \
     PAYMOB_PUBLIC_KEY=... \
     PAYMOB_HMAC_SECRET=... \
     PAYMOB_INTEGRATION_IDS=123456,789012 \
     APP_URL=https://<username>.github.io/<repo>
   supabase functions deploy create-payment
   supabase functions deploy paymob-webhook --no-verify-jwt
   ```
   الـ webhook عنوانه `https://<project-ref>.supabase.co/functions/v1/paymob-webhook`، وبيتبعت لـ Paymob تلقائياً مع كل عملية دفع.
4. **جرّب الأول بوضع الاختبار (Test mode) في Paymob** واتأكد إن الاشتراك بيتفعّل لوحده بعد الدفع، قبل ما تشغّل الحساب الحقيقي.

### 4) النشر على GitHub Pages

1. في GitHub: **Settings → Pages → Source = GitHub Actions**.
2. **Settings → Secrets and variables → Actions**: ضيف `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY`.
3. أي push على `main` بينشر التطبيق تلقائياً (`.github/workflows/deploy.yml`).
4. الطالب يفتح الرابط ويختار «إضافة إلى الشاشة الرئيسية» / «تثبيت».

---

## ملاحظات أمان

- السعر بيتقري من قاعدة البيانات على السيرفر وقت الدفع، يعني الطالب ميقدرش يغيّره.
- التفعيل بيحصل بس من الـ webhook بعد التحقق من توقيع Paymob (HMAC)، أو منك من صفحة صاحب التطبيق.
- مدة الفترة المجانية بتتحسب بساعة السيرفر، فتغيير تاريخ الموبايل مش بيمدّها.
- طلبات الـ AI بتروح من جهاز الطالب لـ Anthropic مباشرة بمفتاحه هو. عشان كده القفل بيمنع المستخدم العادي، لكن مبرمج شاطر يقدر نظرياً يعدّل كود الصفحة على جهازه ويعدّي القفل. منع ده تماماً محتاج إن كل طلبات الـ AI تعدّي على سيرفرك.

## البنية

```
src/lib/ai.ts         طلبات Claude (streaming + structured outputs)
src/lib/account.ts    الحساب والفترة المجانية والدفع وصفحة صاحب التطبيق
src/lib/ingest.ts     PDF (pdf.js) والصور
src/views/            الشاشات
supabase/             قاعدة البيانات ودوال Paymob
```
