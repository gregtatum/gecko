/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=4 sw=4 et tw=79:
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Anderson <danderson@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "ion/MIR.h"
#include "ion/Lowering.h"
#include "Assembler-arm.h"
#include "ion/shared/Lowering-shared-inl.h"
#include "Lowering-arm-inl.h"

using namespace js;
using namespace js::ion;

bool
LIRGeneratorARM::useBox(LInstruction *lir, size_t n, MDefinition *mir,
                        LUse::Policy policy)
{
    JS_ASSERT(mir->type() == MIRType_Value);
    if (!ensureDefined(mir))
        return false;
    lir->setOperand(n, LUse(mir->id(), policy));
    lir->setOperand(n + 1, LUse(VirtualRegisterOfPayload(mir), policy));
    return true;
}

bool
LIRGeneratorARM::lowerConstantDouble(double d, MInstruction *mir)
{
    uint32 index;
    if (!lirGraph_.addConstantToPool(d, &index))
        return false;

    LDouble *lir = new LDouble(LConstantIndex::FromIndex(index));
    return define(lir, mir);
}

bool
LIRGeneratorARM::visitConstant(MConstant *ins)
{
    if (!ins->isEmittedAtUses() && ins->type() != MIRType_Double)
        return emitAtUses(ins);

    if (ins->type() == MIRType_Double) {
        uint32 index;
        if (!lirGraph_.addConstantToPool(ins, &index))
            return false;
        LDouble *lir = new LDouble(LConstantIndex::FromIndex(index));
        return define(lir, ins);
    }

    return LIRGeneratorShared::visitConstant(ins);
}

bool
LIRGeneratorARM::visitBox(MBox *box)
{
    MDefinition *inner = box->getOperand(0);

    // If the box wrapped a double, it needs a new register.
    if (inner->type() == MIRType_Double)
        return defineBox(new LBoxDouble(use(inner, LUse::COPY)), box);

    if (!box->isEmittedAtUses())
        return emitAtUses(box);

    if (inner->isConstant())
        return defineBox(new LValue(inner->toConstant()->value()), box);

    LBox *lir = new LBox(use(inner), inner->type());

    // Otherwise, we should not define a new register for the payload portion
    // of the output, so bypass defineBox().
    uint32 vreg = getVirtualRegister();
    if (vreg >= MAX_VIRTUAL_REGISTERS)
        return false;

    lir->setDef(0, LDefinition(vreg, LDefinition::TYPE));
    lir->setDef(1, LDefinition(inner->id(), LDefinition::PAYLOAD, LDefinition::REDEFINED));
    box->setVirtualRegister(vreg);
    return add(lir);
}

bool
LIRGeneratorARM::visitUnbox(MUnbox *unbox)
{
    // An unbox on arm reads in a type tag (either in memory or a register) and
    // a payload. Unlike most instructions conusming a box, we ask for the type
    // second, so that the result can re-use the first input.
    MDefinition *inner = unbox->getOperand(0);

    if (!ensureDefined(inner))
        return false;

    if (unbox->type() == MIRType_Double) {

        LUnboxDouble *lir = new LUnboxDouble();
        if (unbox->fallible() && !assignSnapshot(lir))
            return false;
        if (!useBox(lir, LUnboxDouble::Input, inner))
            return false;
        return define(lir, unbox);
    }

    LUnbox *lir = new LUnbox(unbox->type());
    lir->setOperand(0, useType(inner, LUse::REGISTER));
    lir->setOperand(1, usePayloadInRegister(inner));

    // Re-use the inner payload's def, for better register allocation.
    LDefinition::Type type = LDefinition::TypeFrom(unbox->type());
    lir->setDef(0, LDefinition(VirtualRegisterOfPayload(inner), type, LDefinition::REDEFINED));
    unbox->setVirtualRegister(VirtualRegisterOfPayload(inner));

    return assignSnapshot(lir) && add(lir);
}

bool
LIRGeneratorARM::visitReturn(MReturn *ret)
{
    MDefinition *opd = ret->getOperand(0);
    JS_ASSERT(opd->type() == MIRType_Value);

    LReturn *ins = new LReturn;
    ins->setOperand(0, LUse(JSReturnReg_Type));
    ins->setOperand(1, LUse(JSReturnReg_Data));
    return fillBoxUses(ins, 0, opd) && add(ins);
}

bool
LIRGeneratorARM::assignSnapshot(LInstruction *ins, BailoutKind kind)
{
    LSnapshot *snapshot = LSnapshot::New(gen, lastResumePoint_, kind);
    if (!snapshot)
        return false;

    for (size_t i = 0; i < lastResumePoint_->numOperands(); i++) {
        MDefinition *ins = lastResumePoint_->getOperand(i);
        LAllocation *type = snapshot->getEntry(i * 2);
        LAllocation *payload = snapshot->getEntry(i * 2 + 1);

        // The register allocation will fill these fields in with actual
        // register/stack assignments. During code generation, we can restore
        // interpreter state with the given information. Note that for
        // constants, including known types, we record a dummy placeholder,
        // since we can recover the same information, much cleaner, from MIR.
        if (ins->isConstant() || ins->isUnused()) {
            *type = LConstantIndex::Bogus();
            *payload = LConstantIndex::Bogus();
        } else if (ins->type() != MIRType_Value) {
            *type = LConstantIndex::Bogus();
            *payload = use(ins, LUse::KEEPALIVE);
        } else {
            *type = useType(ins, LUse::KEEPALIVE);
            *payload = usePayload(ins, LUse::KEEPALIVE);
        }
    }

    ins->assignSnapshot(snapshot);
    return true;
}
// x = !y
bool
LIRGeneratorARM::lowerForALU(LInstructionHelper<1, 1, 0> *ins, MDefinition *mir, MDefinition *input)
{
    ins->setOperand(0, useRegister(input));
    return define(ins, mir,
                  LDefinition(LDefinition::TypeFrom(mir->type()), LDefinition::DEFAULT));
}

// z = x+y
bool
LIRGeneratorARM::lowerForALU(LInstructionHelper<1, 2, 0> *ins, MDefinition *mir, MDefinition *lhs, MDefinition *rhs)
{
    ins->setOperand(0, useRegister(lhs));
    ins->setOperand(1, useRegisterOrConstant(rhs));
    return define(ins, mir,
                  LDefinition(LDefinition::TypeFrom(mir->type()), LDefinition::DEFAULT));
}

bool
LIRGeneratorARM::lowerForFPU(LInstructionHelper<1, 1, 0> *ins, MDefinition *mir, MDefinition *input)
{
    ins->setOperand(0, useRegister(input));
    return define(ins, mir,
                  LDefinition(LDefinition::TypeFrom(mir->type()), LDefinition::DEFAULT));

}

bool
LIRGeneratorARM::lowerForFPU(LInstructionHelper<1, 2, 0> *ins, MDefinition *mir, MDefinition *lhs, MDefinition *rhs)
{
    ins->setOperand(0, useRegister(lhs));
    ins->setOperand(1, useRegister(rhs));
    return define(ins, mir,
                  LDefinition(LDefinition::TypeFrom(mir->type()), LDefinition::DEFAULT));
}

bool
LIRGeneratorARM::defineUntypedPhi(MPhi *phi, size_t lirIndex)
{
    LPhi *type = current->getPhi(lirIndex + VREG_TYPE_OFFSET);
    LPhi *payload = current->getPhi(lirIndex + VREG_DATA_OFFSET);

    uint32 typeVreg = getVirtualRegister();
    if (typeVreg >= MAX_VIRTUAL_REGISTERS)
        return false;

    phi->setVirtualRegister(typeVreg);

    uint32 payloadVreg = getVirtualRegister();
    if (payloadVreg >= MAX_VIRTUAL_REGISTERS)
        return false;
    JS_ASSERT(typeVreg + 1 == payloadVreg);

    type->setDef(0, LDefinition(typeVreg, LDefinition::TYPE));
    payload->setDef(0, LDefinition(payloadVreg, LDefinition::PAYLOAD));
    return annotate(type) && annotate(payload);
}

void
LIRGeneratorARM::lowerUntypedPhiInput(MPhi *phi, uint32 inputPosition, LBlock *block, size_t lirIndex)
{
    // oh god, what is this code?
    MDefinition *operand = phi->getOperand(inputPosition);
    LPhi *type = block->getPhi(lirIndex + VREG_TYPE_OFFSET);
    LPhi *payload = block->getPhi(lirIndex + VREG_DATA_OFFSET);
    type->setOperand(inputPosition, LUse(operand->id() + VREG_TYPE_OFFSET, LUse::ANY));
    payload->setOperand(inputPosition, LUse(VirtualRegisterOfPayload(operand), LUse::ANY));
}

bool
LIRGeneratorARM::lowerForShift(LInstructionHelper<1, 2, 0> *ins, MDefinition *mir, MDefinition *lhs, MDefinition *rhs)
{

    ins->setOperand(0, useRegister(lhs));
    // this check probably not necessary, it is a carry-over from the x86 code.
    if (rhs->isConstant()) {
        ins->setOperand(1, useOrConstant(rhs));
    } else {
        // If our operand isn't a constant, then we want to strip off any
        // unnecessary bits.  We do this by generating an AND LInstruction
        // and dumping it into the instruction stream right before the shift.
        LBitOp *LAnd = new LBitOp(JSOP_BITAND);
        LAnd->setOperand(0, useRegister(rhs));
        LAnd->setOperand(1, LConstantIndex::FromIndex(0x1f));
        LAnd->setDef(0, LDefinition(LDefinition::TypeFrom(mir->type()), LDefinition::DEFAULT));
        uint32 vreg = getVirtualRegister();
        if (vreg >= MAX_VIRTUAL_REGISTERS)
            return false;
        LAnd->getDef(0)->setVirtualRegister(vreg);
        if (!add(LAnd))
            return false;
        LUse policy = LUse(LUse::REGISTER);
        policy.setVirtualRegister(vreg);
        ins->setOperand(1, policy);
    }
    return define(ins, mir,
                  LDefinition(LDefinition::TypeFrom(mir->type()), LDefinition::DEFAULT));
}

bool
LIRGeneratorARM::lowerDivI(MDiv *div)
{
    LDivI *lir = new LDivI(useFixed(div->lhs(), r0), useFixed(div->rhs(), r1),
                           tempFixed(r2), tempFixed(r3)/*, tempFixed(lr)*/);
    
    return define(lir, div,
                  LDefinition(LDefinition::TypeFrom(div->type()), LDefinition::DEFAULT))
    && assignSnapshot(lir);
}

bool
LIRGeneratorARM::visitTableSwitch(MTableSwitch *tableswitch)
{
    MDefinition *opd = tableswitch->getOperand(0);

    // There should be at least 1 successor. The default case!
    JS_ASSERT(tableswitch->numSuccessors() > 0);

    // If there are no cases, the default case is always taken.
    if (tableswitch->numSuccessors() == 1)
        return add(new LGoto(tableswitch->getDefault()));

    // Case indices are numeric, so other types will always go to the default case.
    if (opd->type() != MIRType_Int32 && opd->type() != MIRType_Double)
        return add(new LGoto(tableswitch->getDefault()));

    // Return an LTableSwitch, capable of handling either an integer or
    // floating-point index.
    LAllocation index;
    LDefinition tempInt;
    if (opd->type() == MIRType_Int32) {
        index = useCopy(opd);
        tempInt = LDefinition::BogusTemp();
    } else {
        index = useRegister(opd);
        tempInt = temp(LDefinition::INTEGER);
    }
    return add(new LTableSwitch(index, tempInt, tableswitch));
}

bool
LIRGeneratorARM::visitGuardShape(MGuardShape *ins)
{
    LDefinition tempInt = temp(LDefinition::INTEGER);
    LGuardShape *guard = new LGuardShape(useRegister(ins->obj()), tempInt);
    return assignSnapshot(guard) && add(guard, ins);
}
