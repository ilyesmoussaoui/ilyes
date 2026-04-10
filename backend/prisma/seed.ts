import { PrismaClient, MemberType, Gender, MemberStatus, UserRole, PlanType, PaymentType, PaymentItemType, SubscriptionStatus, EnrollmentStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const FIRST_NAMES_LATIN = ['Ahmed', 'Yacine', 'Sara', 'Amina', 'Mohamed', 'Lina', 'Karim', 'Nadia', 'Riad', 'Hana', 'Bilal', 'Samira', 'Youcef', 'Meriem', 'Anis', 'Rania', 'Walid', 'Imane', 'Nabil', 'Dounia'];
const LAST_NAMES_LATIN = ['Benali', 'Kaddour', 'Messaoudi', 'Belkacem', 'Hadj', 'Zidane', 'Cherif', 'Sebti', 'Belaid', 'Mansouri', 'Saidi', 'Brahimi', 'Nait', 'Boumediene', 'Tahri', 'Khelifi', 'Rahmani', 'Zerouali', 'Djebbar', 'Oukaci'];
const FIRST_NAMES_AR = ['أحمد', 'ياسين', 'سارة', 'أمينة', 'محمد', 'لينا', 'كريم', 'نادية', 'رياض', 'هناء', 'بلال', 'سميرة', 'يوسف', 'مريم', 'أنيس', 'رانية', 'وليد', 'إيمان', 'نبيل', 'دنيا'];
const LAST_NAMES_AR = ['بن علي', 'قدور', 'مسعودي', 'بلقاسم', 'حاج', 'زيدان', 'شريف', 'سبتي', 'بلعيد', 'منصوري', 'سعيدي', 'براهيمي', 'ناث', 'بومدين', 'طاهري', 'خليفي', 'رحماني', 'زروالي', 'جبار', 'وقاسي'];

function randomDateOfBirth(minAge: number, maxAge: number): Date {
  const now = new Date();
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(Date.UTC(now.getUTCFullYear() - age, month, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main(): Promise<void> {
  console.log('Clearing existing seed data...');
  await prisma.paymentItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.memberDiscipline.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.memberContact.deleteMany();
  await prisma.member.deleteMany();
  await prisma.discipline.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating admin user...');
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@gym-saas.local',
      passwordHash: adminPassword,
      role: UserRole.admin,
      fullNameLatin: 'System Administrator',
      fullNameArabic: 'مدير النظام',
      isActive: true,
    },
  });

  const receptionistPassword = await bcrypt.hash('Recept123!', 10);
  await prisma.user.create({
    data: {
      email: 'reception@gym-saas.local',
      passwordHash: receptionistPassword,
      role: UserRole.receptionist,
      fullNameLatin: 'Front Desk',
      fullNameArabic: 'الاستقبال',
      isActive: true,
      createdBy: admin.id,
    },
  });

  console.log('Creating disciplines...');
  const taekwondo = await prisma.discipline.create({
    data: { name: 'Taekwondo', isActive: true },
  });
  const karate = await prisma.discipline.create({
    data: { name: 'Karate', isActive: true },
  });
  const boxing = await prisma.discipline.create({
    data: { name: 'Boxing', isActive: true },
  });
  const disciplines = [taekwondo, karate, boxing];

  console.log('Creating 20 test members...');
  for (let i = 0; i < 20; i++) {
    const firstLatin = FIRST_NAMES_LATIN[i % FIRST_NAMES_LATIN.length]!;
    const lastLatin = LAST_NAMES_LATIN[i % LAST_NAMES_LATIN.length]!;
    const firstAr = FIRST_NAMES_AR[i % FIRST_NAMES_AR.length]!;
    const lastAr = LAST_NAMES_AR[i % LAST_NAMES_AR.length]!;
    const gender = i % 2 === 0 ? Gender.male : Gender.female;
    const dob = randomDateOfBirth(8, 45);
    const discipline = disciplines[i % disciplines.length]!;
    const startDate = addDays(new Date(), -30);
    const endDate = addDays(startDate, 30);

    const member = await prisma.member.create({
      data: {
        type: MemberType.athlete,
        firstNameLatin: firstLatin,
        lastNameLatin: lastLatin,
        firstNameArabic: firstAr,
        lastNameArabic: lastAr,
        gender,
        dateOfBirth: dob,
        placeOfBirth: 'Algiers',
        status: MemberStatus.active,
        createdBy: admin.id,
        contacts: {
          create: [
            {
              type: 'phone',
              value: `+2135${String(50000000 + i).padStart(8, '0')}`,
              isPrimary: true,
            },
            {
              type: 'email',
              value: `${firstLatin.toLowerCase()}.${lastLatin.toLowerCase()}${i}@example.dz`,
              isPrimary: true,
            },
          ],
        },
        emergencyContacts: {
          create: [
            {
              name: `Parent of ${firstLatin}`,
              phone: `+2136${String(60000000 + i).padStart(8, '0')}`,
              relationship: 'parent',
            },
          ],
        },
        disciplines: {
          create: [
            {
              disciplineId: discipline.id,
              enrollmentDate: startDate,
              status: EnrollmentStatus.active,
              beltRank: 'White',
            },
          ],
        },
        subscriptions: {
          create: [
            {
              disciplineId: discipline.id,
              planType: PlanType.monthly,
              startDate,
              endDate,
              amount: 300000, // 3000 DZD in centimes
              status: SubscriptionStatus.active,
              createdBy: admin.id,
            },
          ],
        },
      },
    });

    const totalAmount = 300000;
    const paidAmount = i % 3 === 0 ? 150000 : 300000;
    await prisma.payment.create({
      data: {
        memberId: member.id,
        receiptNumber: `RCP-${Date.now()}-${String(i).padStart(4, '0')}`,
        totalAmount,
        paidAmount,
        remaining: totalAmount - paidAmount,
        paymentType: paidAmount === totalAmount ? PaymentType.full : PaymentType.partial,
        createdBy: admin.id,
        items: {
          create: [
            {
              description: `${discipline.name} — Monthly subscription`,
              amount: totalAmount,
              type: PaymentItemType.subscription,
            },
          ],
        },
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    disciplines: await prisma.discipline.count(),
    members: await prisma.member.count(),
    payments: await prisma.payment.count(),
    subscriptions: await prisma.subscription.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
