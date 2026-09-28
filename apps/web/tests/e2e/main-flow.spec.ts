import { expect, test, type Page, type TestInfo } from '@playwright/test';

/**
 * SPEC 16 akışı — boş veritabanı + LLU_MOCK=true ile çalışan API'ye karşı.
 * Kurulum → (mock LLU hesabı ekleme) → canlı değer → rapor AGP → yazdırma sayfası → not ekleme.
 * Testler sıralı: ilk test kurulumu yapar, sonrakiler aynı hesapla giriş yapar.
 */
test.describe.configure({ mode: 'serial' });

const ADMIN = { email: 'admin@example.com', password: 'CokGizliSifre123', name: 'Yönetici' };

/**
 * Oturumu proje başına bir kez açar ve çerezleri yeniden kullanır
 * (API girişleri IP başına dakikada 5 ile sınırlar).
 */
const sessions = new Map<string, Awaited<ReturnType<ReturnType<Page['context']>['cookies']>>>();

async function signIn(page: Page, testInfo: TestInfo) {
  const saved = sessions.get(testInfo.project.name);
  if (saved) {
    await page.context().addCookies(saved);
    return;
  }
  await login(page);
  sessions.set(testInfo.project.name, await page.context().cookies());
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(ADMIN.email);
  await page.getByLabel('Şifre').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await acceptConsentIfShown(page);
}

/** Giriş/kurulum isteği tamamlanana kadar bekler; KVKK ekranı çıkarsa onaylar. */
async function acceptConsentIfShown(page: Page) {
  const consent = page.getByRole('heading', { name: /KVKK/ });
  const shell = page.getByRole('navigation').first();
  await expect(consent.or(shell)).toBeVisible({ timeout: 15_000 });
  if (await consent.isVisible()) {
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Onayla ve devam et' }).click();
    await expect(shell).toBeVisible({ timeout: 15_000 });
  }
}

test('kurulum, KVKK onayı ve mock LLU hesabı', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(setup|login)$/);
  if (page.url().endsWith('/setup')) {
    await page.getByLabel('Görünen ad').fill(ADMIN.name);
    await page.getByLabel('E-posta').fill(ADMIN.email);
    await page.getByLabel('Şifre').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Yönetici hesabını oluştur' }).click();
  } else {
    // Diğer proje (mobil/masaüstü) kurulumu zaten yaptı.
    await login(page);
  }
  await acceptConsentIfShown(page);
  sessions.set(testInfo.project.name, await page.context().cookies());

  // Hasta yoksa mock LLU hesabı ekle (mock modda her kimlik bilgisi kabul edilir)
  await page.goto('/ayarlar');
  const accountsCard = page.getByRole('heading', { name: 'LibreLinkUp hesapları' });
  await expect(accountsCard).toBeVisible();
  const empty = page.getByText('Henüz hesap yok.');
  await expect(empty.or(page.getByTestId('llu-account-row').first())).toBeVisible({
    timeout: 15_000,
  });
  if (await empty.isVisible()) {
    await page.getByRole('button', { name: '+ Hesap ekle' }).click();
    await page.getByLabel('Etiket').fill('Mock');
    await page.getByLabel('LibreLinkUp e-posta').fill('follower@example.com');
    await page.getByLabel('LibreLinkUp şifre').fill('mock-password');
    await page.getByRole('button', { name: 'Ekle ve bağlantıyı test et' }).click();
    await expect(page.getByText(/hasta bulundu/)).toBeVisible({ timeout: 20_000 });
  }
});

test('giriş → canlı değer görünür', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('current-value')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('current-value')).toContainText(/\d/);
});

test('rapor sayfasında AGP çizilir ve yazdırma sayfası açılır', async ({
  page,
  context,
}, testInfo) => {
  await signIn(page, testInfo);
  await page.goto('/raporlar');
  const agp = page.getByTestId('agp-chart');
  await expect(agp).toBeVisible({ timeout: 30_000 });
  await expect(agp.locator('svg path').first()).toBeAttached();

  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await context.addInitScript(() => {
    window.print = () => undefined;
  });
  const [printPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'PDF indir' }).click(),
  ]);
  await printPage.waitForLoadState();
  await expect(printPage).toHaveURL(/\/raporlar\/yazdir/);
  await expect(printPage.getByRole('heading', { name: 'Glukoz raporu' })).toBeVisible();
  await expect(printPage.getByTestId('agp-chart')).toBeVisible({ timeout: 30_000 });
});

test('hızlı giriş: yemek ve su, grafikte işaret', async ({ page }, testInfo) => {
  await signIn(page, testInfo);
  await page.goto('/');
  const quick = page.getByTestId('quick-entry');
  await expect(quick).toBeVisible({ timeout: 30_000 });

  await quick.getByRole('button', { name: /Yemek/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /Belirli zaman/ }).click();
  await dialog.getByLabel('Karbonhidrat (g)').fill('45');
  await dialog.getByLabel('Açıklama').fill('E2E test öğünü');
  await dialog.getByRole('button', { name: 'Kaydet' }).click();
  await expect(dialog).toBeHidden();

  await quick.getByRole('button', { name: /Su/ }).click();
  await dialog.getByRole('button', { name: '330 ml' }).click();
  await dialog.getByRole('button', { name: 'Kaydet' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('/gunluk');
  await expect(page.locator('ol').getByText('E2E test öğünü').first()).toBeVisible();
  await expect(page.locator('ol').getByText('330 ml').first()).toBeVisible();
});
