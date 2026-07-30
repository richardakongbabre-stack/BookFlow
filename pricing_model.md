# BookFlow Pricing & Monetization Model

BookFlow utilizes a multi-dimensional monetization framework designed to support freelancers, growing salons, and enterprise franchises, while securing recurrent revenue streams for the platform.

---

## 1. Subscription Tiers for Providers

| Tier | Price (Monthly) | Staff Cap | Service Cap | Bookings / Month | Supported Notifications | Commission Rate | Features Included |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Free** | $0 | 1 | 3 | Max 30 | Email only | 0% | Basic Calendar, Customer Profile Logs |
| **Starter** | $29 | 3 | 5 | Max 150 | Email + 50 free SMS | 5% | Availability settings, Basic Analytics Dashboard |
| **Professional** | $79 | 10 | Unlimited | Unlimited | Email + 250 free SMS | 5% | SMS reminders, Advanced Analytics, Featured listing badge |
| **Enterprise** | $199 | Unlimited | Unlimited | Unlimited | Email + 1000 free SMS | 3% | White-label custom domain, Dedicated API keys, VIP support |

---

## 2. Commission-on-Bookings Flow

To minimize upfront provider friction, BookFlow handles transaction processing via Stripe Connect:
- **Transaction Processing**: When a customer books a paid service, the payment is processed online.
- **Platform Split**: BookFlow collects its commission percentage directly from the transaction amount:
  - **Formula**:
    $$\text{Platform Commission} = \text{Booking Total} \times \text{Tier Commission Rate}$$
    $$\text{Provider Net Share} = \text{Booking Total} - \text{Platform Commission} - \text{Payment Gateway Processing Fees}$$
- **Gateway Fees**: Standard payment processor fees (e.g. Stripe 2.9% + $0.30) are paid by the provider unless configured otherwise in the platform settings.

---

## 3. Add-on Services & Upgrades

Providers can purchase individual add-on upgrades to enhance their system:
- **SMS Packages**: Additional SMS bundles (e.g., $10 for 500 SMS text reminders for appointments) when monthly quotas are exceeded.
- **Featured Listing Boosts**: Prominently display the provider at the top of local customer searches for a flat fee (e.g., $15/week).
- **Custom Domain Add-on**: For Starter or Professional tiers, mount their own domain for an additional $10/month (standard in Enterprise).

---

## 4. B2B White-Label & Organization Licensing

For large organizations, franchises, or cosmetology schools, BookFlow offers a customized white-label licensing program:
- **Custom Branding**: Fully customized logos, corporate brand color styles, app icons, and specialized templates.
- **Dedicated Hosting / Private Tenant**: The option to deploy the system in a separate private virtual cloud, isolation of audit logs, and custom OAuth integration for provider staff (e.g., Okta/Active Directory).
- **Annual Contracts**: Volume discounting based on active staff capacity starting at $2,500/year.
