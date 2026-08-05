#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const files = [
  'data/lp159/destination-source-selection.json',
  'reports/lp159/category-coverage-matrix.json',
  'reports/lp159/licensing-assessment.json',
  'reports/lp159/refresh-strategy.json',
  'reports/lp159/destination-quality-assessment.json',
  'reports/lp159/integration-plan.json',
  'reports/lp159/final-destination-source-recommendation.json'
];
for (const file of files) JSON.parse(readFileSync(file, 'utf8'));
const selection = JSON.parse(readFileSync(files[0], 'utf8'));
const recommendation = JSON.parse(readFileSync(files[6], 'utf8'));
if (selection.performsRuntimeChange || selection.performsDeploymentChange || selection.performsActivationChange || selection.protectedInfrastructureModified) throw new Error('LP159 must remain planning-only');
if (!recommendation.decisions.Approved.includes('overture-places')) throw new Error('Overture primary source must be approved');
if (!recommendation.decisions.Rejected.includes('google-places')) throw new Error('Google Places durable registry use must be rejected');
console.log(JSON.stringify({ milestone: 'LP159', status: 'PASS', files }, null, 2));
