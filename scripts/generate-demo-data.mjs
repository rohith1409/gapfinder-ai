import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'demo-data');
fs.mkdirSync(dir, { recursive: true });

const sampleMaterials = [
  {
    name: 'algebra-syllabus.txt',
    type: 'syllabus',
    text: 'Quadratic equations and factorization are core algebra topics. Students should solve equations by factoring, completing the square, and using the quadratic formula. Functions, domain, and range are key range-check skills for exams.',
  },
  {
    name: 'biology-notes.txt',
    type: 'notes',
    text: 'Genetics includes dominant and recessive traits. Meiosis halves the chromosome number and produces haploid cells. Cell division and human physiology are important exam topics.',
  },
];

fs.writeFileSync(path.join(dir, 'sample-materials.json'), JSON.stringify({ sampleMaterials }, null, 2));
console.log('Created demo-data/sample-materials.json');
