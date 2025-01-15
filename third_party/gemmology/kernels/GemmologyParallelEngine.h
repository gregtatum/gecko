#ifndef GEMMOLOGY_PARALLEL_ENGINE_H
#define GEMMOLOGY_PARALLEL_ENGINE_H

#include "threading/Thread.h"
#include "threading/CpuCount.h"

#include <array>
#include <atomic>
#include <functional>
#include <chrono>
#include <cassert>
#include <iostream>
#include <new>

namespace gemmology {

/* Abstract computation task, independent from the actual function being run
 */
struct Task {
  void operator()() { doit(); }

 protected:
  virtual void doit() = 0;
};

/* Actual task encapsulating a function from the stack.
 */
template <class F>
struct GemmologyTask final : Task {
  GemmologyTask(std::atomic<size_t>& Curr, size_t End, size_t Stride, F& f)
      : Curr(Curr), End(End), Stride(Stride), f(f) {}

  void doit() override {
    for (;;) {
      size_t Expected = Curr;
      if (Expected < End) {
        size_t Next = Expected + Stride;
        if (Curr.compare_exchange_weak(Expected, Next)) {
          f(Expected);
        }
      } else {
        break;
      }
    }
  }

 private:
  std::atomic<size_t>& Curr;
  size_t End, Stride;
  F& f;
};

/* Thread that can run tasks one after the other (no task queue) and dies after
 * a given amount of idle time
 */
class GemmologyThread : js::Thread {
  bool initialized = false;

  using milliseconds = std::chrono::duration<double, std::milli>;
  static constexpr milliseconds max_idle_time{100.};

  void loop() {
    for (;;) {
      auto t_start = std::chrono::high_resolution_clock::now();

      // Actively wait for another task, but bail out after some time.
      while (!activeTask) {
        auto t_end = std::chrono::high_resolution_clock::now();
        if (milliseconds{t_end - t_start} > max_idle_time) {
          initialized = false;
          return;
        }
      }
      (*activeTask)();
      activeTask = nullptr;
    }
  }

  /* Restart underlying thread if it finished
   */
  bool ensure_init() {
    if (!initialized) {
      if ((initialized = js::Thread::init([this]() { this->loop(); }))) {
        detach();
        return true;
      }
      return false;
    }
    return true;
  }

 public:
  /* Submit a new task for this thread. Only valid if no existing task is
   * running.
   */
  bool run(Task& t) {
    assert(!activeTask && "Already running task when pushing a new one");
    activeTask = &t;
    return ensure_init();
  }

  /* Actively wait for any running task to be finished
   */
  void wait() { while (activeTask); }
  std::atomic<Task*> activeTask = nullptr;
};

template <class F>
GemmologyTask(std::atomic<size_t>& Curr, size_t End, size_t Stride,
              F& f) -> GemmologyTask<F>;

template <size_t MaxPoolSize=32>
struct JSThreadStaticExecutionEngine {
  JSThreadStaticExecutionEngine() : CpuCount(std::min<size_t>(MaxPoolSize, js::GetCPUCount())) {}

  template <class F>
  inline void operator()(size_t Start, size_t End, size_t Stride, F&& f) {
    const size_t NbIter = (End - Start) / Stride;

    // Empirically, allocating at most half of the available CPU works better.
    // Maybe it avoids over-subscription, maybe it avoids hyper-threading
    // issues.
    const size_t NbThread = std::min(NbIter, (1 + CpuCount) / 2);

    std::atomic<size_t> Curr = Start;

    using GemmologyTask = GemmologyTask<F>;
    alignas(GemmologyTask) char ScratchTasks[MaxPoolSize -1][sizeof(GemmologyTask)];

    size_t activeThreadID = 0;

    for (activeThreadID = 0; activeThreadID < NbThread - 1; ++activeThreadID) {
      GemmologyTask* activeTask = new (ScratchTasks) GemmologyTask(Curr, End, Stride, f);
      if (!ThreadPool[activeThreadID].run(*activeTask))
        break;  // This gently falls back to sequential execution.
    }

    // Avoid spawning a thread where we can reuse existing one.
    GemmologyTask{Curr, End, Stride, f}();

    for (size_t threadID = 0; threadID < activeThreadID; ++threadID) {
      ThreadPool[threadID].wait();
    }
  }

 private:
  const size_t CpuCount;

  std::array<GemmologyThread, MaxPoolSize - 1> ThreadPool;

};

template <>
struct JSThreadStaticExecutionEngine<1> {
  template <class F>
  inline void operator()(size_t Start, size_t End, size_t Stride, F&& f) {
    for (size_t i = Start; i < End; i += Stride) {
      f(i);
    };
  }
};

}  // namespace gemmology
#endif
