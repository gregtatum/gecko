/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sts=4 et sw=4 tw=99:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * JavaScript Debugging support - Hook support
 */

#include "jsd.h"

JSTrapStatus
jsd_InterruptHandler(JSContext *cx, JSScript *script, jsbytecode *pc, jsval *rval,
                     void *closure)
{
    JSDScript*      jsdscript;
    JSDContext*     jsdc = (JSDContext*) closure;
    JSD_ExecutionHookProc hook;
    void*                 hookData;

    if( ! jsdc || ! jsdc->inited )
        return JSTRAP_CONTINUE;

    if( JSD_IS_DANGEROUS_THREAD(jsdc) )
        return JSTRAP_CONTINUE;

    /* local in case jsdc->interruptHook gets cleared on another thread */
    JSD_LOCK();
    hook     = jsdc->interruptHook;
    hookData = jsdc->interruptHookData;
    JSD_UNLOCK();

    if (!hook)
        return JSTRAP_CONTINUE;
    
    JSD_LOCK_SCRIPTS(jsdc);
    jsdscript = jsd_FindOrCreateJSDScript(jsdc, cx, script, JSNullFramePtr());
    JSD_UNLOCK_SCRIPTS(jsdc);
    if( ! jsdscript )
        return JSTRAP_CONTINUE;

    return jsd_CallExecutionHook(jsdc, cx, JSD_HOOK_INTERRUPTED,
                                 hook, hookData, rval);
}

JSTrapStatus
jsd_DebuggerHandler(JSContext *cx, JSScript *script, jsbytecode *pc,
                    jsval *rval, void *closure)
{
    JSDScript*      jsdscript;
    JSDContext*     jsdc = (JSDContext*) closure;
    JSD_ExecutionHookProc hook;
    void*                 hookData;

    if( ! jsdc || ! jsdc->inited )
        return JSTRAP_CONTINUE;

    if( JSD_IS_DANGEROUS_THREAD(jsdc) )
        return JSTRAP_CONTINUE;

    /* local in case jsdc->debuggerHook gets cleared on another thread */
    JSD_LOCK();
    hook     = jsdc->debuggerHook;
    hookData = jsdc->debuggerHookData;
    JSD_UNLOCK();
    if(!hook)
        return JSTRAP_CONTINUE;

    JSD_LOCK_SCRIPTS(jsdc);
    jsdscript = jsd_FindOrCreateJSDScript(jsdc, cx, script, JSNullFramePtr());
    JSD_UNLOCK_SCRIPTS(jsdc);
    if( ! jsdscript )
        return JSTRAP_CONTINUE;

    return jsd_CallExecutionHook(jsdc, cx, JSD_HOOK_DEBUGGER_KEYWORD,
                                 hook, hookData, rval);
}


JSTrapStatus
jsd_ThrowHandler(JSContext *cx, JSScript *script, jsbytecode *pc,
                 jsval *rvalArg, void *closure)
{
    JSDScript*      jsdscript;
    JSDContext*     jsdc = (JSDContext*) closure;
    JSD_ExecutionHookProc hook;
    void*                 hookData;

    if( ! jsdc || ! jsdc->inited )
        return JSTRAP_CONTINUE;

    if( JSD_IS_DANGEROUS_THREAD(jsdc) )
        return JSTRAP_CONTINUE;

    /* local in case jsdc->throwHook gets cleared on another thread */
    JSD_LOCK();
    hook     = jsdc->throwHook;
    hookData = jsdc->throwHookData;
    JSD_UNLOCK();
    if (!hook)
        return JSTRAP_CONTINUE;

    JSD_LOCK_SCRIPTS(jsdc);
    jsdscript = jsd_FindOrCreateJSDScript(jsdc, cx, script, JSNullFramePtr());
    JSD_UNLOCK_SCRIPTS(jsdc);
    if( ! jsdscript )
        return JSTRAP_CONTINUE;

    JS::RootedValue rval(cx);
    JS_GetPendingException(cx, &rval);

    JSTrapStatus result = jsd_CallExecutionHook(jsdc, cx, JSD_HOOK_THROW,
                                                hook, hookData, rval.address());
    *rvalArg = rval;
    return result;
}

JSTrapStatus
jsd_CallExecutionHook(JSDContext* jsdc,
                      JSContext *cx,
                      unsigned type,
                      JSD_ExecutionHookProc hook,
                      void* hookData,
                      jsval* rval)
{
    unsigned hookanswer = JSD_HOOK_THROW == type ? 
                            JSD_HOOK_RETURN_CONTINUE_THROW :
                            JSD_HOOK_RETURN_CONTINUE;
    JSDThreadState* jsdthreadstate;

    if(hook && nullptr != (jsdthreadstate = jsd_NewThreadState(jsdc, cx)))
    {
        if ((type != JSD_HOOK_THROW && type != JSD_HOOK_INTERRUPTED) ||
            jsdc->flags & JSD_MASK_TOP_FRAME_ONLY ||
            !(jsdthreadstate->flags & TS_HAS_DISABLED_FRAME))
        {
            /*
             * if it's not a throw and it's not an interrupt,
             * or we're only masking the top frame,
             * or there are no disabled frames in this stack,
             * then call out.
             */
             hookanswer = hook(jsdc, jsdthreadstate, type, hookData, rval);
             jsd_DestroyThreadState(jsdc, jsdthreadstate);
        }
    }

    switch(hookanswer)
    {
        case JSD_HOOK_RETURN_ABORT:
        case JSD_HOOK_RETURN_HOOK_ERROR:
            return JSTRAP_ERROR;
        case JSD_HOOK_RETURN_RET_WITH_VAL:
            return JSTRAP_RETURN;
        case JSD_HOOK_RETURN_THROW_WITH_VAL:
            return JSTRAP_THROW;
        case JSD_HOOK_RETURN_CONTINUE:
            break;
        case JSD_HOOK_RETURN_CONTINUE_THROW:
            /* only makes sense for jsd_ThrowHandler (which init'd rval) */
            JS_ASSERT(JSD_HOOK_THROW == type);
            return JSTRAP_THROW;
        default:
            JS_ASSERT(0);
            break;
    }
    return JSTRAP_CONTINUE;
}

bool
jsd_CallCallHook (JSDContext* jsdc,
                  JSContext *cx,
                  unsigned type,
                  JSD_CallHookProc hook,
                  void* hookData)
{
    bool hookanswer;
    JSDThreadState*  jsdthreadstate;
    
    hookanswer = false;
    if(hook && nullptr != (jsdthreadstate = jsd_NewThreadState(jsdc, cx)))
    {
        hookanswer = hook(jsdc, jsdthreadstate, type, hookData);
        jsd_DestroyThreadState(jsdc, jsdthreadstate);
    }

    return hookanswer;
}

bool
jsd_SetInterruptHook(JSDContext*           jsdc,
                     JSD_ExecutionHookProc hook,
                     void*                 callerdata)
{
    JSD_LOCK();
    jsdc->interruptHookData  = callerdata;
    jsdc->interruptHook      = hook;
    JS_SetInterrupt(jsdc->jsrt, jsd_InterruptHandler, (void*) jsdc);
    JSD_UNLOCK();

    return true;
}

bool
jsd_ClearInterruptHook(JSDContext* jsdc)
{
    JSD_LOCK();
    JS_ClearInterrupt(jsdc->jsrt, nullptr, nullptr);
    jsdc->interruptHook      = nullptr;
    JSD_UNLOCK();

    return true;
}

bool
jsd_SetDebugBreakHook(JSDContext*           jsdc,
                      JSD_ExecutionHookProc hook,
                      void*                 callerdata)
{
    JSD_LOCK();
    jsdc->debugBreakHookData  = callerdata;
    jsdc->debugBreakHook      = hook;
    JSD_UNLOCK();

    return true;
}

bool
jsd_ClearDebugBreakHook(JSDContext* jsdc)
{
    JSD_LOCK();
    jsdc->debugBreakHook      = nullptr;
    JSD_UNLOCK();

    return true;
}

bool
jsd_SetDebuggerHook(JSDContext*           jsdc,
                      JSD_ExecutionHookProc hook,
                      void*                 callerdata)
{
    JSD_LOCK();
    jsdc->debuggerHookData  = callerdata;
    jsdc->debuggerHook      = hook;
    JSD_UNLOCK();

    return true;
}

bool
jsd_ClearDebuggerHook(JSDContext* jsdc)
{
    JSD_LOCK();
    jsdc->debuggerHook      = nullptr;
    JSD_UNLOCK();

    return true;
}

bool
jsd_SetThrowHook(JSDContext*           jsdc,
                 JSD_ExecutionHookProc hook,
                 void*                 callerdata)
{
    JSD_LOCK();
    jsdc->throwHookData  = callerdata;
    jsdc->throwHook      = hook;
    JSD_UNLOCK();

    return true;
}

bool
jsd_ClearThrowHook(JSDContext* jsdc)
{
    JSD_LOCK();
    jsdc->throwHook      = nullptr;
    JSD_UNLOCK();

    return true;
}

bool
jsd_SetFunctionHook(JSDContext*      jsdc,
                    JSD_CallHookProc hook,
                    void*            callerdata)
{
    JSD_LOCK();
    jsdc->functionHookData  = callerdata;
    jsdc->functionHook      = hook;
    JSD_UNLOCK();

    return true;
}

bool
jsd_ClearFunctionHook(JSDContext* jsdc)
{
    JSD_LOCK();
    jsdc->functionHook      = nullptr;
    JSD_UNLOCK();

    return true;
}

bool
jsd_SetTopLevelHook(JSDContext*      jsdc,
                    JSD_CallHookProc hook,
                    void*            callerdata)
{
    JSD_LOCK();
    jsdc->toplevelHookData  = callerdata;
    jsdc->toplevelHook      = hook;
    JSD_UNLOCK();

    return true;
}

bool
jsd_ClearTopLevelHook(JSDContext* jsdc)
{
    JSD_LOCK();
    jsdc->toplevelHook      = nullptr;
    JSD_UNLOCK();

    return true;
}

