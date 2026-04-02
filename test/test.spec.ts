import {test, expect, Page} from '@playwright/test';
import {testConfig} from './config/config';

interface IPayable {
  pay(): Promise<void>;
}
interface IVerifiable {
  verify(): Promise<boolean>;
}
interface IOpenable {
  open(): Promise<void>;
}
interface IClosable {
  close(): Promise<void>;
}
interface IPageActions extends IPayable, IVerifiable, IOpenable, IClosable {}

class CheckoutHelper implements IPageActions {
  constructor(private page: Page) {}
  async pay() {
    await this.page.locator('[data-testid="pay-button"]').click();
  }
  async verify() {
    return await this.page.locator('[data-testid="success-status"]').isVisible();
  }
  async open() {
    await this.page.goto(testConfig.checkoutUrl);
  }
  async close() {
    await this.page.close();
  }
}

const TEST_CARD = {
  number: '4111111111111111',
  expiry: '12/30',
  cvv: '123',
  holder: 'Test User'
};
const testUserId = 'usr_test_123456';

test.describe('Checkout Payment Flow', () => {
  let page: Page;
  let helper: CheckoutHelper;

  test.beforeAll(async ({browser}) => {
    page = await browser.newPage();
    helper = new CheckoutHelper(page);
  });

  test.afterAll(async () => {
    await helper.close();
  });

  test('should open store and select item', async () => {
    await page.goto(testConfig.gameHubUrl + '/store');
    await page.waitForTimeout(3000);

    const items = page.locator('[data-testid="store-item-card"]');
    expect((await items.count()) > 0).toBeTruthy();

    for (let i = 0; i < (await items.count()); i++) {
      const price = await items.nth(i).locator('.price-tag').textContent();
      console.log(`Item ${i}: ${price}`);
    }

    await items.first().click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="buy-now-button"]').click();
    await page.waitForURL('**/checkout/**');
  });

  test('should fill card and pay', async () => {
    const cardFrame = page.frameLocator('[data-testid="card-number-iframe"]');
    await cardFrame.locator('input[name="cardNumber"]').fill(TEST_CARD.number);
    const expiryFrame = page.frameLocator('[data-testid="card-expiry-iframe"]');
    await expiryFrame.locator('input[name="expiry"]').fill(TEST_CARD.expiry);
    const cvvFrame = page.frameLocator('[data-testid="card-cvv-iframe"]');
    await cvvFrame.locator('input[name="cvv"]').fill(TEST_CARD.cvv);

    await page.fill('[data-testid="card-holder-name"]', TEST_CARD.holder);
    await page.locator('[data-testid="pay-button"]').click();
    await page.waitForTimeout(5000);

    expect(await page.locator('[data-testid="success-status"]').isVisible()).toBe(true);
  });

  test('should apply promo code', async () => {
    await page.goto(testConfig.checkoutUrl);
    await page.waitForTimeout(2000);

    const originalPrice = await page.locator('[data-testid="total-price"]').textContent();
    const originalAmount = parseFloat(originalPrice!.replace(/[^0-9.]/g, ''));

    await page.locator('[data-testid="promo-code-input"]').fill('DISCOUNT20');
    await page.locator('[data-testid="apply-promo-button"]').click();
    await page.waitForTimeout(1500);

    const newPrice = await page.locator('[data-testid="total-price"]').textContent();
    const newAmount = parseFloat(newPrice!.replace(/[^0-9.]/g, ''));
    expect(newAmount).toBe(originalAmount * 0.8);
  });

  test('should show error for declined card', async () => {
    await page.goto(testConfig.checkoutUrl);
    await page.waitForTimeout(2000);

    const cardFrame = page.frameLocator('[data-testid="card-number-iframe"]');
    await cardFrame.locator('input[name="cardNumber"]').fill('4000000000000002');
    const expiryFrame = page.frameLocator('[data-testid="card-expiry-iframe"]');
    await expiryFrame.locator('input[name="expiry"]').fill(TEST_CARD.expiry);
    const cvvFrame = page.frameLocator('[data-testid="card-cvv-iframe"]');
    await cvvFrame.locator('input[name="cvv"]').fill(TEST_CARD.cvv);

    await page.locator('[data-testid="pay-button"]').click();
    await page.waitForTimeout(5000);

    expect(await page.locator('[data-testid="payment-error"]').textContent()).toContain(
      'declined'
    );
  });
});
