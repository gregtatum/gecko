use au = gfx::geometry;
use au::au;
use core::dvec::DVec;
use dl = gfx::display_list;
use dom::node::Node;
use geom::rect::Rect;
use geom::point::Point2D;
// TODO: pub-use these
use layout::block::BlockFlowData;
use layout::box::{LogicalBefore, LogicalAfter, RenderBox};
use layout::context::LayoutContext;
use layout::debug::BoxedDebugMethods;
use layout::inline::InlineFlowData;
use layout::root::RootFlowData;
use util::tree;

/** Servo's experimental layout system builds a tree of FlowContexts
and RenderBoxes, and figures out positions and display attributes of
tree nodes. Positions are computed in several tree traversals driven
by fundamental data dependencies of inline and block layout.

Flows are interior nodes in the layout tree, and correspond closely to
flow contexts in the CSS specification. Flows are responsible for
positioning their child flow contexts and render boxes. Flows have
purpose-specific fields, such as auxilliary line box structs,
out-of-flow child lists, and so on.

Currently, the important types of flows are:

 * BlockFlow: a flow that establishes a block context. It has several
   child flows, each of which are positioned according to block
   formatting context rules (as if child flows CSS block boxes). Block
   flows also contain a single GenericBox to represent their rendered
   borders, padding, etc. (In the future, this render box may be
   folded into BlockFlow to save space.)

 * InlineFlow: a flow that establishes an inline context. It has a
   flat list of child boxes/flows that are subject to inline layout
   and line breaking, and structs to represent line breaks and mapping
   to CSS boxes, for the purpose of handling `getClientRects()`.

*/

/* The type of the formatting context, and data specific to each
context, such as linebox structures or float lists */ 
enum FlowContext {
    AbsoluteFlow(FlowData), 
    BlockFlow(FlowData, BlockFlowData),
    FloatFlow(FlowData),
    InlineBlockFlow(FlowData),
    InlineFlow(FlowData, InlineFlowData),
    RootFlow(FlowData, RootFlowData),
    TableFlow(FlowData)
}

enum FlowContextType {
    Flow_Absolute, 
    Flow_Block,
    Flow_Float,
    Flow_InlineBlock,
    Flow_Inline,
    Flow_Root,
    Flow_Table
}

trait FlowContextMethods {
    pure fn d(&self) -> &self/FlowData;
    pure fn inline(&self) -> &self/InlineFlowData;
    pure fn block(&self) -> &self/BlockFlowData;
    pure fn root(&self) -> &self/RootFlowData;
    fn bubble_widths(@self, &LayoutContext);
    fn assign_widths(@self, &LayoutContext);
    fn assign_height(@self, &LayoutContext);
    fn build_display_list_recurse(@self, &dl::DisplayListBuilder, dirty: &Rect<au>,
                                  offset: &Point2D<au>, &dl::DisplayList);
    pure fn foldl_boxes_for_node<B: Copy>(Node, +seed: B, cb: pure fn&(+a: B,@RenderBox) -> B) -> B;
    pure fn iter_boxes_for_node<T>(Node, cb: pure fn&(@RenderBox) -> T);
}

/* A particular kind of layout context. It manages the positioning of
   render boxes within the context.  */
struct FlowData {
    mut node: Option<Node>,
    /* reference to parent, children flow contexts */
    tree: tree::Tree<@FlowContext>,
    /* TODO (Issue #87): debug only */
    mut id: int,

    /* layout computations */
    // TODO: min/pref and position are used during disjoint phases of
    // layout; maybe combine into a single enum to save space.
    mut min_width: au,
    mut pref_width: au,
    mut position: Rect<au>,
}

fn FlowData(id: int) -> FlowData {
    FlowData {
        node: None,
        tree: tree::empty(),
        id: id,

        min_width: au(0),
        pref_width: au(0),
        position: au::zero_rect()
    }
}

struct PendingEntry { 
    start_box: @RenderBox,
    start_idx: uint 
}

// helper object for building the initial box list and making the
// mapping between DOM nodes and boxes.
struct BoxConsumer {
    flow: @FlowContext,
    stack: DVec<PendingEntry>,
}

fn BoxConsumer(flow: @FlowContext) -> BoxConsumer {
    debug!("Creating box consumer for flow: f%s", flow.debug_str());
    BoxConsumer {
        flow: flow,
        stack: DVec()
    }
}

impl BoxConsumer {
    pub fn push_box(ctx: &LayoutContext, box: @RenderBox) {
        debug!("BoxConsumer: pushing box b%d to flow f%d", box.d().id, self.flow.d().id);
        let length = match self.flow {
            @InlineFlow(*) => self.flow.inline().boxes.len(),
            _ => 0
        };
        let entry = PendingEntry { start_box: box, start_idx: length };
        self.stack.push(entry);

        match self.flow {
            @InlineFlow(*) => {
                if box.requires_inline_spacers() {
                    do box.create_inline_spacer_for_side(ctx, LogicalBefore).iter |spacer: &@RenderBox| {
                        self.flow.inline().boxes.push(*spacer);
                    }
                }
            },
            @BlockFlow(*) | @RootFlow(*) => {
                assert self.stack.len() == 1;
            },
            _ => { warn!("push_box() not implemented for flow f%d", self.flow.d().id) }
        }
    }

    pub fn pop_box(ctx: &LayoutContext, box: @RenderBox) {
        assert self.stack.len() > 0;
        let entry = self.stack.pop();
        assert core::box::ptr_eq(box, entry.start_box);

        debug!("BoxConsumer: popping box b%d to flow f%d", box.d().id, self.flow.d().id);

        match self.flow {
            @InlineFlow(*) => {
                let span_length = self.flow.inline().boxes.len() - entry.start_idx + 1;
                match (span_length, box.requires_inline_spacers()) {
                    // leaf box
                    (1, _) => { self.flow.inline().boxes.push(box); return; },
                    // if this non-leaf box generates extra horizontal
                    // spacing, add a SpacerBox for it.
                    (_, true) => {
                        do box.create_inline_spacer_for_side(ctx, LogicalAfter).iter |spacer: &@RenderBox| {
                            self.flow.inline().boxes.push(*spacer);
                        }
                    },
                    // non-leaf with no spacer; do nothing
                    (_, false) => { }
                }

                // only create NodeRanges for non-leaf nodes.
                let final_span_length = self.flow.inline().boxes.len() - entry.start_idx + 1;
                assert final_span_length > 1;
                let mapping = { node: copy box.d().node, 
                               span: { 
                                   mut start: entry.start_idx as u16, 
                                   mut len: final_span_length as u16
                               }
                              };
                debug!("BoxConsumer: adding element range=%?", mapping.span);
                self.flow.inline().elems.push(mapping);
            },
            @BlockFlow(*) => {
                assert self.stack.len() == 0;
                assert self.flow.block().box.is_none();
                self.flow.block().box = Some(entry.start_box);
            },
            @RootFlow(*) => {
                assert self.stack.len() == 0;
                assert self.flow.root().box.is_none();
                self.flow.root().box = Some(entry.start_box);
            },
            _ => { warn!("pop_box not implemented for flow %?", self.flow.d().id) }
        }
    }
}

impl FlowContext : FlowContextMethods {
    pure fn d(&self) -> &self/FlowData {
        match *self {
            AbsoluteFlow(ref d)    => d,
            BlockFlow(ref d, _)    => d,
            FloatFlow(ref d)       => d,
            InlineBlockFlow(ref d) => d,
            InlineFlow(ref d, _)   => d,
            RootFlow(ref d, _)     => d,
            TableFlow(ref d)       => d
        }
    }

    pure fn inline(&self) -> &self/InlineFlowData {
        match *self {
            InlineFlow(_, ref i) => i,
            _ => fail fmt!("Tried to access inline data of non-inline: f%d", self.d().id)
        }
    }

    pure fn block(&self) -> &self/BlockFlowData {
        match *self {
            BlockFlow(_, ref b) => b,
            _ => fail fmt!("Tried to access block data of non-block: f%d", self.d().id)
        }
    }

    pure fn root(&self) -> &self/RootFlowData {
        match *self {
            RootFlow(_, ref r) => r,
            _ => fail fmt!("Tried to access root data of non-root: f%d", self.d().id)
        }
    }

    fn bubble_widths(@self, ctx: &LayoutContext) {
        match self {
            @BlockFlow(*)  => self.bubble_widths_block(ctx),
            @InlineFlow(*) => self.bubble_widths_inline(ctx),
            @RootFlow(*)   => self.bubble_widths_root(ctx),
            _ => fail fmt!("Tried to bubble_widths of flow: f%d", self.d().id)
        }
    }

    fn assign_widths(@self, ctx: &LayoutContext) {
        match self {
            @BlockFlow(*)  => self.assign_widths_block(ctx),
            @InlineFlow(*) => self.assign_widths_inline(ctx),
            @RootFlow(*)   => self.assign_widths_root(ctx),
            _ => fail fmt!("Tried to assign_widths of flow: f%d", self.d().id)
        }
    }

    fn assign_height(@self, ctx: &LayoutContext) {
        match self {
            @BlockFlow(*)  => self.assign_height_block(ctx),
            @InlineFlow(*) => self.assign_height_inline(ctx),
            @RootFlow(*)   => self.assign_height_root(ctx),
            _ => fail fmt!("Tried to assign_height of flow: f%d", self.d().id)
        }
    }

    fn build_display_list_recurse(@self, builder: &dl::DisplayListBuilder, dirty: &Rect<au>,
                                  offset: &Point2D<au>, list: &dl::DisplayList) {
        debug!("FlowContext::build_display_list at %?: %s", self.d().position, self.debug_str());

        match self {
            @RootFlow(*) => self.build_display_list_root(builder, dirty, offset, list),
            @BlockFlow(*) => self.build_display_list_block(builder, dirty, offset, list),
            @InlineFlow(*) => self.build_display_list_inline(builder, dirty, offset, list),
            _ => fail fmt!("Tried to build_display_list_recurse of flow: %?", self)
        }
    }

    // Actual methods that do not require much flow-specific logic
    pure fn foldl_all_boxes<B: Copy>(seed: B, 
                                     cb: pure fn&(a: B,@RenderBox) -> B) -> B {
        match self {
            RootFlow(*)   => option::map_default(&self.root().box, seed, |box| { cb(seed, *box) }),
            BlockFlow(*)  => option::map_default(&self.block().box, seed, |box| { cb(seed, *box) }),
            InlineFlow(*) => do self.inline().boxes.foldl(seed) |acc, box| { cb(*acc, *box) },
            _ => fail fmt!("Don't know how to iterate node's RenderBoxes for %?", self)
        }
    }

    pure fn foldl_boxes_for_node<B: Copy>(node: Node, seed: B, 
                                          cb: pure fn&(a: B,@RenderBox) -> B) -> B {
        do self.foldl_all_boxes(seed) |acc, box| {
            if box.d().node == node { cb(acc, box) }
            else { acc }
        }
    }

    pure fn iter_all_boxes<T>(cb: pure fn&(@RenderBox) -> T) {
        match self {
            RootFlow(*)   => do self.root().box.iter |box| { cb(*box); },
            BlockFlow(*)  => do self.block().box.iter |box| { cb(*box); },
            InlineFlow(*) => for self.inline().boxes.each |box| { cb(*box); },
            _ => fail fmt!("Don't know how to iterate node's RenderBoxes for %?", self)
        }
    }

    pure fn iter_boxes_for_node<T>(node: Node,
                                   cb: pure fn&(@RenderBox) -> T) {
        do self.iter_all_boxes |box| {
            if box.d().node == node { cb(box); }
        }
    }
}

/* The tree holding FlowContexts */
enum FlowTree { FlowTree }

impl FlowTree : tree::ReadMethods<@FlowContext> {
    fn each_child(ctx: @FlowContext, f: fn(box: @FlowContext) -> bool) {
        tree::each_child(&self, &ctx, |box| f(*box) )
    }

    fn with_tree_fields<R>(box: &@FlowContext, f: fn(&tree::Tree<@FlowContext>) -> R) -> R {
        f(&box.d().tree)
    }
}

impl FlowTree : tree::WriteMethods<@FlowContext> {
    fn add_child(parent: @FlowContext, child: @FlowContext) {
        tree::add_child(&self, parent, child)
    }

    pure fn eq(a: &@FlowContext, b: &@FlowContext) -> bool { core::box::ptr_eq(*a, *b) }

    fn with_tree_fields<R>(box: &@FlowContext, f: fn(&tree::Tree<@FlowContext>) -> R) -> R {
        f(&box.d().tree)
    }
}


impl FlowContext : BoxedDebugMethods {
    fn dump(@self) {
        self.dump_indent(0u);
    }

    /** Dumps the flow tree, for debugging, with indentation. */
    fn dump_indent(@self, indent: uint) {
        let mut s = ~"|";
        for uint::range(0u, indent) |_i| {
            s += ~"---- ";
        }

        s += self.debug_str();
        debug!("%s", s);

        for FlowTree.each_child(self) |child| {
            child.dump_indent(indent + 1u) 
        }
    }
    
    fn debug_str(@self) -> ~str {
        let repr = match *self {
            InlineFlow(*) => {
                let mut s = self.inline().boxes.foldl(~"InlineFlow(children=", |s, box| {
                    fmt!("%s b%d", *s, box.d().id)
                });
                s += ~")"; s
            },
            BlockFlow(*) => {
                match self.block().box {
                    Some(box) => fmt!("BlockFlow(box=b%d)", box.d().id),
                    None => ~"BlockFlow",
                }
            },
            RootFlow(*) => {
                match self.root().box {
                    Some(box) => fmt!("RootFlo(box=b%d)", box.d().id),
                    None => ~"RootFlow",
                }
            },
            _ => ~"(Unknown flow)"
        };
            
        fmt!("f%? %?", self.d().id, repr)
    }
}
