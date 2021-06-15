export default function makeWorker() {
  return new SharedWorker('workshop-worker-built.js');
}
