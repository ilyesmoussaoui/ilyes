import { PrismaClient, MemberType, Gender, MemberStatus, UserRole, PlanType, PaymentType, PaymentItemType, SubscriptionStatus, EnrollmentStatus, AttendanceMethod } from '@prisma/client';
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
  await prisma.memberNote.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.paymentItem.deleteMany();
  await prisma.memberEquipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.memberDiscipline.deleteMany();
  await prisma.document.deleteMany();
  await prisma.familyLink.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.memberContact.deleteMany();
  await prisma.member.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.discipline.deleteMany();

  // ─── Users ───

  // Defensive check: RBAC migration must have been applied
  const adminRole = await prisma.role.findUnique({ where: { id: '00000000-0000-0000-0000-000000000001' } });
  if (!adminRole) {
    throw new Error('RBAC migration has not been applied; run prisma migrate deploy first');
  }

  const ROLE_IDS = {
    admin:        '00000000-0000-0000-0000-000000000001',
    receptionist: '00000000-0000-0000-0000-000000000003',
    coach:        '00000000-0000-0000-0000-000000000004',
  } as const;

  console.log('Upserting admin + receptionist + coach users...');
  const adminPasswordHash = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sport.local' },
    update: {
      passwordHash: adminPasswordHash,
      role: UserRole.admin,
      roleId: ROLE_IDS.admin,
      fullNameLatin: 'System Administrator',
      fullNameArabic: null,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'admin@sport.local',
      passwordHash: adminPasswordHash,
      role: UserRole.admin,
      roleId: ROLE_IDS.admin,
      fullNameLatin: 'System Administrator',
      fullNameArabic: null,
      isActive: true,
    },
  });

  const receptionistPasswordHash = await bcrypt.hash('Receptionist123!', 12);
  await prisma.user.upsert({
    where: { email: 'receptionist@sport.local' },
    update: {
      passwordHash: receptionistPasswordHash,
      role: UserRole.receptionist,
      roleId: ROLE_IDS.receptionist,
      fullNameLatin: 'Main Receptionist',
      fullNameArabic: null,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'receptionist@sport.local',
      passwordHash: receptionistPasswordHash,
      role: UserRole.receptionist,
      roleId: ROLE_IDS.receptionist,
      fullNameLatin: 'Main Receptionist',
      fullNameArabic: null,
      isActive: true,
      createdBy: admin.id,
    },
  });

  // Coach users
  const coachPasswordHash = await bcrypt.hash('Coach123!', 12);
  const coach1 = await prisma.user.upsert({
    where: { email: 'coach.taekwondo@sport.local' },
    update: {
      passwordHash: coachPasswordHash,
      role: UserRole.coach,
      roleId: ROLE_IDS.coach,
      fullNameLatin: 'Master Kim Yong',
      fullNameArabic: 'كيم يونغ',
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'coach.taekwondo@sport.local',
      passwordHash: coachPasswordHash,
      role: UserRole.coach,
      roleId: ROLE_IDS.coach,
      fullNameLatin: 'Master Kim Yong',
      fullNameArabic: 'كيم يونغ',
      isActive: true,
      createdBy: admin.id,
    },
  });

  const coach2 = await prisma.user.upsert({
    where: { email: 'coach.swimming@sport.local' },
    update: {
      passwordHash: coachPasswordHash,
      role: UserRole.coach,
      roleId: ROLE_IDS.coach,
      fullNameLatin: 'Rachid Benmoussa',
      fullNameArabic: 'رشيد بن موسى',
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'coach.swimming@sport.local',
      passwordHash: coachPasswordHash,
      role: UserRole.coach,
      roleId: ROLE_IDS.coach,
      fullNameLatin: 'Rachid Benmoussa',
      fullNameArabic: 'رشيد بن موسى',
      isActive: true,
      createdBy: admin.id,
    },
  });

  const coach3 = await prisma.user.upsert({
    where: { email: 'coach.equestrian@sport.local' },
    update: {
      passwordHash: coachPasswordHash,
      role: UserRole.coach,
      roleId: ROLE_IDS.coach,
      fullNameLatin: 'Sophie Delacroix',
      fullNameArabic: 'صوفي دولاكروا',
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'coach.equestrian@sport.local',
      passwordHash: coachPasswordHash,
      role: UserRole.coach,
      roleId: ROLE_IDS.coach,
      fullNameLatin: 'Sophie Delacroix',
      fullNameArabic: 'صوفي دولاكروا',
      isActive: true,
      createdBy: admin.id,
    },
  });

  // ─── Disciplines ───

  console.log('Creating disciplines...');
  const taekwondo = await prisma.discipline.create({
    data: { name: 'Taekwondo', isActive: true },
  });
  const swimming = await prisma.discipline.create({
    data: { name: 'Swimming', isActive: true },
  });
  const equestrian = await prisma.discipline.create({
    data: { name: 'Equestrian', isActive: true },
  });
  const disciplines = [taekwondo, swimming, equestrian];

  // ─── Time Slots ───

  console.log('Creating time slots...');
  // Taekwondo: Sun, Tue, Thu — coach1 (Master Kim Yong)
  await prisma.timeSlot.createMany({
    data: [
      { disciplineId: taekwondo.id, dayOfWeek: 0, startTime: '09:00', endTime: '10:30', maxCapacity: 25, coachId: coach1.id },
      { disciplineId: taekwondo.id, dayOfWeek: 0, startTime: '16:00', endTime: '17:30', maxCapacity: 25, coachId: coach1.id },
      { disciplineId: taekwondo.id, dayOfWeek: 2, startTime: '09:00', endTime: '10:30', maxCapacity: 25, coachId: coach1.id },
      { disciplineId: taekwondo.id, dayOfWeek: 2, startTime: '16:00', endTime: '17:30', maxCapacity: 25, coachId: coach1.id },
      { disciplineId: taekwondo.id, dayOfWeek: 4, startTime: '09:00', endTime: '10:30', maxCapacity: 25, coachId: coach1.id },
      { disciplineId: taekwondo.id, dayOfWeek: 4, startTime: '16:00', endTime: '17:30', maxCapacity: 25, coachId: coach1.id },
    ],
  });
  // Swimming: Mon, Wed, Sat — coach2 (Rachid Benmoussa)
  await prisma.timeSlot.createMany({
    data: [
      { disciplineId: swimming.id, dayOfWeek: 1, startTime: '08:00', endTime: '09:00', maxCapacity: 15, coachId: coach2.id },
      { disciplineId: swimming.id, dayOfWeek: 1, startTime: '10:00', endTime: '11:00', maxCapacity: 15, coachId: coach2.id },
      { disciplineId: swimming.id, dayOfWeek: 1, startTime: '17:00', endTime: '18:00', maxCapacity: 15, coachId: coach2.id },
      { disciplineId: swimming.id, dayOfWeek: 3, startTime: '08:00', endTime: '09:00', maxCapacity: 15, coachId: coach2.id },
      { disciplineId: swimming.id, dayOfWeek: 3, startTime: '10:00', endTime: '11:00', maxCapacity: 15, coachId: coach2.id },
      { disciplineId: swimming.id, dayOfWeek: 3, startTime: '17:00', endTime: '18:00', maxCapacity: 15, coachId: coach2.id },
      { disciplineId: swimming.id, dayOfWeek: 6, startTime: '09:00', endTime: '10:00', maxCapacity: 20, coachId: coach2.id },
      { disciplineId: swimming.id, dayOfWeek: 6, startTime: '11:00', endTime: '12:00', maxCapacity: 20, coachId: coach2.id },
    ],
  });
  // Equestrian: Tue, Fri, Sat — coach3 (Sophie Delacroix)
  await prisma.timeSlot.createMany({
    data: [
      { disciplineId: equestrian.id, dayOfWeek: 2, startTime: '07:00', endTime: '08:30', maxCapacity: 8, coachId: coach3.id },
      { disciplineId: equestrian.id, dayOfWeek: 2, startTime: '14:00', endTime: '15:30', maxCapacity: 8, coachId: coach3.id },
      { disciplineId: equestrian.id, dayOfWeek: 5, startTime: '07:00', endTime: '08:30', maxCapacity: 8, coachId: coach3.id },
      { disciplineId: equestrian.id, dayOfWeek: 5, startTime: '14:00', endTime: '15:30', maxCapacity: 8, coachId: coach3.id },
      { disciplineId: equestrian.id, dayOfWeek: 6, startTime: '08:00', endTime: '09:30', maxCapacity: 10, coachId: coach3.id },
      { disciplineId: equestrian.id, dayOfWeek: 6, startTime: '15:00', endTime: '16:30', maxCapacity: 10, coachId: coach3.id },
    ],
  });

  // ─── Fee Settings ───

  console.log('Upserting fee settings...');
  const FEE_DEFAULTS: Array<{ key: string; value: string }> = [
    { key: 'registrationFee',   value: '50000'  },
    { key: 'licenseFee',        value: '120000' },
    { key: 'extraSessionPrice', value: '75000'  },
  ];
  for (const { key, value } of FEE_DEFAULTS) {
    await prisma.setting.upsert({
      where: { key },
      update: {},            // do not overwrite if admin has customised it
      create: { key, value, updatedBy: admin.id },
    });
  }

  // ─── Subscription Plans ───

  console.log('Creating subscription plans...');
  const planMatrix: Array<{ discipline: typeof taekwondo; prices: Partial<Record<PlanType, number>> }> = [
    {
      discipline: taekwondo,
      prices: {
        [PlanType.monthly]:   300000,
        [PlanType.quarterly]: 800000,
        [PlanType.biannual]:  1500000,
        [PlanType.annual]:    2800000,
      },
    },
    {
      discipline: swimming,
      prices: {
        [PlanType.monthly]:   400000,
        [PlanType.quarterly]: 1100000,
        [PlanType.biannual]:  2000000,
        [PlanType.annual]:    3800000,
      },
    },
    {
      discipline: equestrian,
      prices: {
        [PlanType.monthly]:   600000,
        [PlanType.quarterly]: 1600000,
        [PlanType.biannual]:  3000000,
        [PlanType.annual]:    5500000,
      },
    },
  ];
  for (const { discipline, prices } of planMatrix) {
    for (const [planType, amount] of Object.entries(prices) as Array<[PlanType, number]>) {
      await prisma.subscriptionPlan.upsert({
        where: { disciplineId_planType: { disciplineId: discipline.id, planType } },
        update: { amount, isActive: true, deletedAt: null },
        create: { disciplineId: discipline.id, planType, amount, isActive: true },
      });
    }
  }

  // ─── Equipment ───

  console.log('Creating equipment...');
  await prisma.equipment.createMany({
    data: [
      // Taekwondo equipment
      { name: 'Dobok (Uniform)', disciplineId: taekwondo.id, price: 350000, stockQuantity: 50 },
      { name: 'Chest Protector', disciplineId: taekwondo.id, price: 500000, stockQuantity: 30 },
      { name: 'Headgear', disciplineId: taekwondo.id, price: 280000, stockQuantity: 30 },
      { name: 'Shin Guards', disciplineId: taekwondo.id, price: 180000, stockQuantity: 40 },
      // Swimming equipment
      { name: 'Swimming Goggles', disciplineId: swimming.id, price: 150000, stockQuantity: 60 },
      { name: 'Swim Cap', disciplineId: swimming.id, price: 50000, stockQuantity: 100 },
      { name: 'Kickboard', disciplineId: swimming.id, price: 120000, stockQuantity: 25 },
      // Equestrian equipment
      { name: 'Riding Helmet', disciplineId: equestrian.id, price: 800000, stockQuantity: 15 },
      { name: 'Riding Boots', disciplineId: equestrian.id, price: 650000, stockQuantity: 20 },
      { name: 'Riding Gloves', disciplineId: equestrian.id, price: 180000, stockQuantity: 30 },
    ],
  });

  // ─── Test Members ───

  console.log('Creating 20 test members...');
  const firstThreeMembers: Array<{ id: string; disciplineId: string }> = [];
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
              beltRank: discipline.name === 'Taekwondo' ? 'White' : null,
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

    if (i < 3) {
      firstThreeMembers.push({ id: member.id, disciplineId: discipline.id });
    }
  }

  // ─── Rich data for first 3 members ───────────────────────────────────────────

  console.log('Creating attendance records, audit logs, and notes for first 3 members...');

  const MEMBER_NOTES: string[][] = [
    [
      'Member joined the club with high enthusiasm. Excellent attendance during the first month.',
      'Parent requested a schedule change to afternoon sessions due to school hours.',
      'Awarded best newcomer at the monthly ceremony.',
    ],
    [
      'Member shows strong progress in technique. Coach recommends moving to advanced group.',
      'Medical certificate due for renewal next month. Reminder sent to family.',
      'Requested a temporary pause in training due to exams. Approved for 2 weeks.',
    ],
    [
      'Enrolled as part of a family group discount program.',
      'Equipment (dobok) needs replacement — old one is worn out.',
      'Attendance has been inconsistent this month. Follow-up call scheduled.',
    ],
  ];

  const AUDIT_ACTIONS = [
    { tableName: 'members', fieldName: 'status', oldValue: 'pending', newValue: 'active' },
    { tableName: 'members', fieldName: 'photo_path', oldValue: null, newValue: 'photo/profile.jpg' },
    { tableName: 'subscriptions', fieldName: 'status', oldValue: 'pending', newValue: 'active' },
    { tableName: 'payments', fieldName: 'paid_amount', oldValue: '0', newValue: '300000' },
    { tableName: 'documents', fieldName: 'status', oldValue: 'pending', newValue: 'valid' },
    { tableName: 'member_disciplines', fieldName: 'belt_rank', oldValue: null, newValue: 'White' },
    { tableName: 'members', fieldName: 'place_of_birth', oldValue: null, newValue: 'Algiers' },
  ];

  for (let mi = 0; mi < firstThreeMembers.length; mi++) {
    const memberEntry = firstThreeMembers[mi]!;
    const memberId = memberEntry.id;
    const disciplineId = memberEntry.disciplineId;

    // ── Attendance records: 25 spread over last 3 months ──
    const attendanceRecords: Array<{
      memberId: string;
      disciplineId: string;
      checkInTime: Date;
      checkOutTime: Date;
      method: AttendanceMethod;
      operatorId: string;
    }> = [];
    for (let d = 0; d < 25; d++) {
      // Spread evenly over last 90 days, skipping some randomly
      const daysAgo = Math.floor(d * 3.5) + Math.floor(Math.random() * 2);
      const checkIn = new Date();
      checkIn.setUTCDate(checkIn.getUTCDate() - daysAgo);
      checkIn.setUTCHours(9 + (d % 3), (d % 4) * 15, 0, 0);
      const checkOut = new Date(checkIn);
      checkOut.setUTCMinutes(checkOut.getUTCMinutes() + 90);

      attendanceRecords.push({
        memberId,
        disciplineId,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        method: d % 5 === 0 ? AttendanceMethod.face : d % 3 === 0 ? AttendanceMethod.barcode : AttendanceMethod.manual,
        operatorId: admin.id,
      });
    }
    await prisma.attendanceRecord.createMany({ data: attendanceRecords });

    // ── Audit logs: 7 entries ──
    for (let ai = 0; ai < AUDIT_ACTIONS.length; ai++) {
      const action = AUDIT_ACTIONS[ai]!;
      const createdAt = new Date();
      createdAt.setUTCDate(createdAt.getUTCDate() - (ai * 4 + mi));
      await prisma.auditLog.create({
        data: {
          tableName: action.tableName,
          recordId: memberId,
          fieldName: action.fieldName,
          oldValue: action.oldValue,
          newValue: action.newValue,
          userId: admin.id,
          reason: `Seeded audit entry ${ai + 1} for member ${mi + 1}`,
          createdAt,
        },
      });
    }

    // ── Notes: 3 per member ──
    const memberNotes = MEMBER_NOTES[mi] ?? [];
    for (let ni = 0; ni < memberNotes.length; ni++) {
      const createdAt = new Date();
      createdAt.setUTCDate(createdAt.getUTCDate() - (ni * 7 + mi * 2));
      await prisma.memberNote.create({
        data: {
          memberId,
          content: memberNotes[ni]!,
          createdBy: admin.id,
          updatedBy: admin.id,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    disciplines: await prisma.discipline.count(),
    subscriptionPlans: await prisma.subscriptionPlan.count(),
    timeSlots: await prisma.timeSlot.count(),
    equipment: await prisma.equipment.count(),
    members: await prisma.member.count(),
    payments: await prisma.payment.count(),
    subscriptions: await prisma.subscription.count(),
    attendanceRecords: await prisma.attendanceRecord.count(),
    memberNotes: await prisma.memberNote.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log('Seed complete:', counts);
  console.log('\u2714 Seeded users:');
  console.log('   admin@sport.local                / Admin123!');
  console.log('   receptionist@sport.local         / Receptionist123!');
  console.log('   coach.taekwondo@sport.local      / Coach123!');
  console.log('   coach.swimming@sport.local       / Coach123!');
  console.log('   coach.equestrian@sport.local     / Coach123!');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
