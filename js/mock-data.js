/* Fake listings for demo mode. Deterministic, so every reload starts the same. */
(function () {
  let seed = 20261015;
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const int = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = a => a[Math.floor(R() * a.length)];
  const hex = n => Array.from({ length: n }, () => int(0, 15).toString(16)).join('');
  const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[int(0, 31)]).join('');
  const DAY = 864e5, now = Date.now();

  const services = [
    ['Phone repair and screen replacement', 'Repairs', 'Same-day fixes for Android and iPhone, with a 30-day guarantee on parts.'],
    ['Home deep cleaning', 'Cleaning', 'Two-person team, own supplies. Flats, duplexes and offices across the mainland.'],
    ['Logo and brand design', 'Design', 'Logos, flyers and social media kits delivered in three days with two free revisions.'],
    ['Emergency plumbing', 'Home services', 'Leaks, blocked drains and tank installs. Available at night and on weekends.'],
    ['Small chops and party catering', 'Food', 'Trays and packs for 20 to 300 guests. Delivery included within the island.'],
    ['Hair braiding and styling', 'Beauty', 'Knotless braids, twists and wigs. Home service available, booking required.'],
    ['Maths and physics tutor', 'Education', 'WAEC and JAMB preparation. Online or in person, small groups welcome.'],
    ['Event photography', 'Media', 'Weddings, birthdays and corporate shoots. Edited gallery within seven days.'],
    ['Mobile car wash', 'Auto', 'We come to your compound with water and power. Interior detailing available.'],
    ['Bridal and event makeup', 'Beauty', 'Soft glam and full glam. Trial sessions are bookable one week ahead.'],
    ['Electrician and inverter installs', 'Home services', 'Wiring, fault finding, solar and inverter setups with a written warranty.'],
    ['Website and landing page builds', 'Tech', 'Fast, mobile-first sites for small businesses. Hosting help included.']
  ];
  const jobs = [
    ['Delivery rider needed', 'Logistics', 'Own bike preferred. Daily pay, weekly bonus. Island routes, start immediately.'],
    ['Shop sales assistant', 'Retail', 'Fashion store in Yaba. Friendly, honest, can start within two weeks.'],
    ['Front desk receptionist', 'Admin', 'Busy clinic needs a calm, organised receptionist. Monday to Saturday.'],
    ['Social media manager (part time)', 'Marketing', 'Plan and post for two food brands. Must show previous work.'],
    ['Kitchen assistant', 'Food', 'Help with prep and cleaning in a growing restaurant. Meals provided.'],
    ['Customer support agent', 'Support', 'Reply to WhatsApp and email enquiries. Good written English is a must.'],
    ['Site security guard', 'Security', 'Night shift at an estate. Experience and a guarantor required.']
  ];
  const owners = ['Adaeze Obi', 'Tunde Bakare', 'Ngozi Eze', 'Ibrahim Musa', 'Funmi Alade', 'Chidi Nwosu', 'Halima Yusuf', 'Segun Adeyemi', 'Blessing Okon', 'Kemi Ojo', 'Emeka Uche', 'Zainab Lawal'];
  const places = ['Lekki, Lagos', 'Ikeja, Lagos', 'Yaba, Lagos', 'Surulere, Lagos', 'Wuse 2, Abuja', 'Port Harcourt', 'Ibadan', 'Enugu'];
  const prices = ['From ₦5,000', 'From ₦12,000', '₦3,500 per visit', 'From ₦25,000', '₦1,500 per hour', 'From ₦8,000'];
  const customs = ['Bulk and weekly rates on request', 'Student discount available', 'Custom quotes for large jobs', ''];

  const statusPool = [].concat(
    Array(12).fill('approved'), Array(6).fill('pending'), Array(4).fill('disapproved'),
    Array(5).fill('expired'), ['deactivated', 'deactivated', 'hidden', 'hidden', 'suspended']
  );
  for (let i = statusPool.length - 1; i > 0; i--) { const j = int(0, i); [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]]; }

  const listings = statusPool.map((status, i) => {
    const type = R() < 0.55 ? 'service' : 'job';
    const [title, category, description] = pick(type === 'service' ? services : jobs);
    const owner = pick(owners);
    const [first, last] = owner.toLowerCase().split(' ');
    const paid = status !== 'pending';
    const usdt = R() < 0.3;
    let createdAt, expiresAt = null;
    if (status === 'approved') { expiresAt = now + int(4, 170) * DAY; createdAt = expiresAt - 180 * DAY; }
    else if (status === 'expired') { expiresAt = now - int(2, 60) * DAY; createdAt = expiresAt - 180 * DAY; }
    else if (status === 'pending') { createdAt = now - int(0, 6) * DAY; }
    else { createdAt = now - int(10, 150) * DAY; expiresAt = createdAt + 180 * DAY; }
    const paidAt = paid ? createdAt + int(1, 90) * 6e5 : null;
    return {
      id: 'SH' + (1001 + i),
      title, type, category, description,
      location: pick(places),
      ownerName: owner,
      phone: '+234 800 555 0' + String(int(100, 199)),
      whatsapp: '+234 800 555 0' + String(int(200, 299)),
      email: first + '.' + last + '@example.com',
      pricing: pick(prices),
      customPricing: pick(customs),
      status,
      statusNote: status === 'disapproved' ? 'Photos did not match the service described.' : (status === 'suspended' ? 'Reported by two customers. Under review.' : ''),
      createdAt, expiresAt,
      likes: int(0, 42),
      media: Array.from({ length: int(1, 5) }, () => ({ url: null })),
      paymentCode: code(),
      payment: paid ? {
        amount: usdt ? pick([1.5, 2, 3]) : pick([300, 500, 1000, 1500]),
        currency: usdt ? 'USDT' : 'NGN',
        method: usdt ? 'NoWalletConnect (' + pick(['Polygon', 'Solana']) + ')' : 'Bank transfer',
        txId: usdt ? '0x' + hex(40) : 'NIP' + int(100000000, 999999999),
        source: usdt ? 'Crypto' : 'Gmail bot',
        paidAt, updatedAt: null, approvedBy: null
      } : null,
      manageLink: paid ? 'https://servicehub-amber.vercel.app/manage.html#k=' + hex(32) : null,
      linkRegeneratedAt: null
    };
  });

  window.DEMO_SEED = listings;

  // Two fake applicants so the Pending admins page has something to show in demo mode
  window.DEMO_APPS_SEED = [
    { firstName: 'Amaka', middleName: 'Grace', lastName: 'Okafor', dob: '2003-04-18', age: 23, gender: 'Female', email: 'amaka.okafor@example.com', phone: '+234 800 555 0311', country: 'Nigeria', location: 'Lagos, Surulere',
      education: "Bachelor's degree or HND", inSchool: 'No', school: 'Computer science', occupation: 'Freelancer', languages: 'English, Igbo', skills: 'Customer support, spreadsheets, checking details carefully.',
      experience: 'Customer support', experienceDetails: 'Two years at a telecom call centre', hours: '10 to 20', timeOfDay: 'Evening', device: 'Both', heardFrom: 'A friend', why: 'I like helping people sort out problems and I can check listings carefully every evening.', referral: '',
      username: 'amaka_o', pwdHash: 'demo-seed', status: 'pending', appliedAt: now - 1 * DAY },
    { firstName: 'Tobi', middleName: 'Samuel', lastName: 'Adewale', dob: '2009-09-02', age: 17, gender: 'Male', email: 'tobi.adewale@example.com', phone: '+234 800 555 0322', country: 'Nigeria', location: 'Ibadan, Bodija',
      guardianName: 'Mrs Bisi Adewale', guardianRelation: 'Mother', guardianPhone: '+234 800 555 0323', guardianOk: 'on',
      education: 'Senior secondary (SSCE, WAEC or NECO)', inSchool: 'Yes', school: 'Government College Ibadan', occupation: 'Student', languages: 'English, Yoruba', skills: 'Fast typing, social media, writing short replies.',
      experience: 'None yet', experienceDetails: '', hours: 'Under 5', timeOfDay: 'Afternoon', device: 'Phone', heardFrom: 'Instagram', why: 'I want to learn how a real platform runs and help keep ServiceHub clean and trusted.', referral: 'Chidi Nwosu',
      username: 'tobi_a', pwdHash: 'demo-seed', status: 'pending', appliedAt: now - 3 * DAY }
  ];
})();
