import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const publicUrl = process.env.PUBLIC_URL || '';
const cabinetImage = (fileName: string) => `${publicUrl}/images/cabinet/${fileName}`;

const MIGRATION_DATA = [
  // Executive Board
  { name: 'Gracie Nguyen', role: 'Co-President', category: 'Executive Board', image: cabinetImage('gracie_nguyen.png'), year: 'Third Year', college: 'Marshall College', major: 'General Biology' },
  { name: 'Phuong Le', role: 'Co-President', category: 'Executive Board', image: cabinetImage('phuong_le.png'), year: 'Third Year', college: 'Muir College', major: 'Political Science - International Relations' },
  { name: 'Stephanie Nguyen', role: 'Co-Intercollegiate Council', category: 'Executive Board', year: 'Second Year Transfer', college: 'ERC College', major: 'Applied Math' },
  { name: 'Kirsten Ngo', role: 'Co-Intercollegiate Council', category: 'Executive Board', image: cabinetImage('kirsten_ngo.png'), year: 'Third Year', college: 'Revelle College', major: 'Human Biology' },
  { name: 'Mindy Tran', role: 'Internal Vice President', category: 'Executive Board', image: cabinetImage('mindy_tran.png'), year: 'Third Year', college: 'Muir College', major: 'General Biology' },
  { name: 'Martin Dang', role: 'Secretary', category: 'Executive Board', image: cabinetImage('martin_dang.png'), year: 'Third Year', college: 'Revelle College', major: 'Math-CS' },
  { name: 'Brandon Thach', role: 'Treasurer', category: 'Executive Board', image: cabinetImage('brandon_thach.png'), year: 'Second Year', college: 'Seventh College', major: 'Business Economics' },
  
  // General Board
  { name: 'Asia Martin', role: 'Co-Media Director', category: 'General Board', year: 'Second Year Transfer', college: 'Sixth College', major: 'Human Biology' },
  { name: 'Anne Fa', role: 'Co-Media Director', category: 'General Board', year: 'Second Year', college: 'Seventh College', major: 'Business Economics' },
  { name: 'Amy Nguyen', role: 'Co-Events Chair', category: 'General Board', image: cabinetImage('amy_nguyen.png'), year: 'Second Year', college: 'Marshall College', major: 'Human Development' },
  { name: 'Havyn Nguyen', role: 'Co-Events Chair', category: 'General Board', image: cabinetImage('havyn_nguyen.png'), year: 'Third Year', college: 'Sixth College', major: 'Math-CS' },
  { name: 'Jonas Truong', role: 'VCN Director & Executive Producer', category: 'General Board', image: cabinetImage('jonas_truong.png'), year: 'Second Year', college: 'Seventh College', major: 'Political Science - Public Law' },
  { name: 'Robert Le', role: 'VCN Director & Executive Producer', category: 'General Board', image: cabinetImage('robert_le.png'), year: 'Third Year', college: 'Seventh College', major: 'Structural Engineering' },
  { name: 'April Pham', role: 'Anh Chi Em Chair', category: 'General Board', image: cabinetImage('april_pham.png'), year: 'Third Year', college: 'Eighth College', major: 'Molecular & Cell Biology' },
  { name: 'Kayla Truong', role: 'Fundraising Chair', category: 'General Board', year: 'Second Year', college: 'Muir College', major: 'Cognitive Science' },
  { name: 'Ingyin Moh', role: 'Community Relations Chair', category: 'General Board', image: cabinetImage('ingyin_moh.png'), year: 'Third Year', college: 'Muir College', major: 'Public Health' },
  { name: 'Abby Le', role: 'Culture & Philanthropy Chair', category: 'General Board', image: cabinetImage('abby_le.png'), year: 'Second Year', college: 'Seventh College', major: 'Business Economics' },
  { name: 'Andy Tran', role: 'Co-Historian', category: 'General Board', image: cabinetImage('andy_tran.png'), year: 'Second Year', college: 'Seventh College', major: 'Human Biology' },
  { name: 'Faith Nguyen', role: 'Co-Historian', category: 'General Board', year: 'Second Year', college: 'Seventh College', major: 'Business Psychology' },
  
  // Interns
  { name: 'Sofia Nguyen', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1MsoSQYzw0AVTn_U2nZ_7HvSiiPnfUNyd', year: '2nd Year', college: 'Marshall College', major: 'Business Economics', funFact: 'i can do a cartwheel' },
  { name: 'Darlene Le', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1mkNDkpliEzsAc5Ct3ObywW5xR7Ggsj30', year: '1st Year', college: 'Eighth College', major: 'Cognitive Science', funFact: 'i won a giveaway to get coldplay floor seats :33' },
  { name: 'Hanni Lam', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1nraJhLxquS0sQawYUXhV96qu0w8DXfaX', year: '2nd Year', college: 'Muir College', major: 'Public Health with Concentration in Medicine Sciences', funFact: 'I went to an Art High School, like Victorious' },
  { name: 'Allyson Hong', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=14P1xdlZqq_dEj99opLaYllxdb8CwbN2Q', year: '1st Year', college: 'Eighth College', major: 'Human Biology', funFact: 'I can do the worm :P' },
  { name: 'Matthew Cao', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1gCTg3o6nH11zUwAJpxApvmb2G2bEKLp_', year: '1st Year', college: 'ERC', major: 'Human Biology', funFact: 'I have a fear of spiders' },
  { name: 'Tristan Vu', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1f9b4y5oVUglrGyXk2-pbxNfO95xYy4vW', year: '1st Year Transfer', college: 'Warren College', major: 'Bioengineering: Biotechnology', funFact: 'i LOVE McChickens' },
  { name: 'Teresa Pham', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1ylqc3ijfu_AttzSk3ee0OxWN8TztC8S8', year: '1st Year Transfer', college: 'Marshall College', major: 'General Biology', funFact: 'i used to live in florida' },
  { name: 'Hailie Cheng', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1trhJaQx_NUHJLdDUAop4KmgCO8vvWyI6', year: '2nd Year', college: 'Seventh College', major: 'Public Health with Concentration in Medicine Sciences', funFact: 'met daniela from katseye & met rice gum (at vsa aftersocial actually) last month' },
];

async function migrate() {
  console.log('Clearing existing records...');
  await supabase.from('cabinet_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log(`Migrating ${MIGRATION_DATA.length} members...`);
  
  for (let i = 0; i < MIGRATION_DATA.length; i++) {
    const mem = MIGRATION_DATA[i];
    const { error } = await supabase.from('cabinet_members').insert([{
      name: mem.name,
      role: mem.role,
      category: mem.category,
      display_order: i, // Maintains order of insertion
      image_url: mem.image || null,
      year: mem.year || null,
      college: mem.college || null,
      major: mem.major || null,
      fun_fact: mem.funFact || null,
    }]);

    if (error) {
      console.error(`Failed to insert ${mem.name}:`, error);
    } else {
      console.log(`Inserted ${mem.name} successfully.`);
    }
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);
