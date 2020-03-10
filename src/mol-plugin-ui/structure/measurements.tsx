/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import * as React from 'react';
import { CollapsableControls, CollapsableState, PurePluginUIComponent } from '../base';
import { lociLabel, dihedralLabel, angleLabel, distanceLabel } from '../../mol-theme/label';
import { Loci } from '../../mol-model/loci';
import { FiniteArray } from '../../mol-util/type-helpers';
import { State } from '../../mol-state';
import { PluginStateObject } from '../../mol-plugin-state/objects';
import { IconButton, ExpandGroup, ToggleButton } from '../controls/common';
import { PluginCommands } from '../../mol-plugin/commands';
import { StructureMeasurementCell, StructureMeasurementOptions, StructureMeasurementParams } from '../../mol-plugin-state/manager/structure/measurement';
import { ParameterControls } from '../controls/parameters';
import { ActionMenu } from '../controls/action-menu';

// TODO details, options (e.g. change text for labels)
// TODO better updates on state changes

const MeasurementFocusOptions = {
    minRadius: 8,
    extraRadius: 4,
    durationMs: 250,
}

interface StructureMeasurementsControlsState extends CollapsableState {
    isDisabled: boolean
}

export class StructureMeasurementsControls extends CollapsableControls<{}, StructureMeasurementsControlsState> {
    componentDidMount() {
        this.subscribe(this.plugin.managers.structure.measurement.behaviors.state, () => {
            this.forceUpdate();
        });

        this.subscribe(this.plugin.behaviors.state.isBusy, v => {
            this.setState({ isDisabled: v })
        });
    }

    defaultState() {
        return {
            isCollapsed: false,
            header: 'Measurements',
            isDisabled: false
        } as StructureMeasurementsControlsState
    }

    renderGroup(cells: ReadonlyArray<StructureMeasurementCell>, header: string) {
        const group: JSX.Element[] = [];
        for (const cell of cells) {
            if (cell.obj) group.push(<MeasurementEntry key={cell.obj.id} cell={cell} />)
        }
        return group.length ? <ExpandGroup header={header} initiallyExpanded={true}>{group}</ExpandGroup> : null;
    }

    renderControls() {
        const measurements = this.plugin.managers.structure.measurement.state;

        return <>
            <AddMeasurement />
            {this.renderGroup(measurements.labels, 'Labels')}
            {this.renderGroup(measurements.distances, 'Distances')}
            {this.renderGroup(measurements.angles, 'Angles')}
            {this.renderGroup(measurements.dihedrals, 'Dihedrals')}
            {this.renderGroup(measurements.orientations, 'Orientations')}
            <MeasurementsOptions />
        </>
    }
}

export class AddMeasurement extends PurePluginUIComponent<{}, { isDisabled: boolean, showActions: boolean }> {
    state = { isDisabled: false, showActions: false }

    componentDidMount() {
        this.subscribe(this.selection.events.changed, () => {
            this.forceUpdate()
        });

        this.subscribe(this.plugin.behaviors.state.isBusy, v => {
            this.setState({ isDisabled: v })
        });
    }

    get selection() {
        return this.plugin.managers.structure.selection;
    }

    measureDistance = () => {
        const loci = this.plugin.managers.structure.selection.history;
        this.plugin.managers.structure.measurement.addDistance(loci[0].loci, loci[1].loci);
    }

    measureAngle = () => {
        const loci = this.plugin.managers.structure.selection.history;
        this.plugin.managers.structure.measurement.addAngle(loci[0].loci, loci[1].loci, loci[2].loci);
    }

    measureDihedral = () => {
        const loci = this.plugin.managers.structure.selection.history;
        this.plugin.managers.structure.measurement.addDihedral(loci[0].loci, loci[1].loci, loci[2].loci, loci[3].loci);
    }

    addLabel = () => {
        const loci = this.plugin.managers.structure.selection.history;
        this.plugin.managers.structure.measurement.addLabel(loci[0].loci);
    }

    addOrientation = () => {
        const loci = this.plugin.managers.structure.selection.history;
        this.plugin.managers.structure.measurement.addOrientation(loci[0].loci);
    }


    get actions(): ActionMenu.Items {
        const history = this.selection.history;
        const ret: ActionMenu.Item[] = [];

        if (history.length >= 1) {
            ret.push(ActionMenu.Item('Label', this.addLabel));
            ret.push(ActionMenu.Item('Orientation', this.addOrientation));
        }
        if (history.length >= 2) {
            ret.push(ActionMenu.Item('Distance', this.measureDistance));
        }
        if (history.length >= 3) {
            ret.push(ActionMenu.Item('Angle', this.measureAngle));
        }
        if (history.length >= 3) {
            ret.push(ActionMenu.Item('Dihedral Angle', this.measureDihedral));
        }
        return ret;
    }
    
    selectAction: ActionMenu.OnSelect = item => {
        this.toggleAdd();
        if (!item) return;
        (item?.value as any)();
    }

    toggleAdd = () => this.setState({ showActions: !this.state.showActions });

    render() {
        if (this.state.isDisabled || this.selection.history.length === 0) return null;

        return <>
            <div className='msp-control-row msp-select-row'>
                <ToggleButton icon='plus' label='Add Measurement' toggle={this.toggleAdd} isSelected={this.state.showActions} disabled={this.state.isDisabled} />
            </div>
            {this.state.showActions && <ActionMenu items={this.actions} onSelect={this.selectAction} />}
        </>
    }
}

export class MeasurementsOptions extends PurePluginUIComponent<{}, { isDisabled: boolean }> {
    state = { isDisabled: false }

    componentDidMount() {
        this.subscribe(this.plugin.managers.structure.measurement.behaviors.state, () => {
            this.forceUpdate();
        });

        this.subscribe(this.plugin.state.dataState.events.isUpdating, v => {
            this.setState({ isDisabled: v })
        });
    }

    changed = (options: StructureMeasurementOptions) => {
        this.plugin.managers.structure.measurement.setOptions(options);
    }

    render() {
        const measurements = this.plugin.managers.structure.measurement.state;

        return <ExpandGroup header='Global Options'>
            <ParameterControls params={StructureMeasurementParams} values={measurements.options} onChangeObject={this.changed} isDisabled={this.state.isDisabled} />
        </ExpandGroup>;
    }
}

class MeasurementEntry extends PurePluginUIComponent<{ cell: StructureMeasurementCell }> {
    componentDidMount() {
        this.subscribe(this.plugin.events.state.cell.stateUpdated, e => {
            if (State.ObjectEvent.isCell(e, this.props.cell)) {
                this.forceUpdate();
            }
        });
    }

    get selections() {
        return this.props.cell.obj?.data.source as PluginStateObject.Molecule.Structure.Selections | undefined;
    }

    delete = () => {
        PluginCommands.State.RemoveObject(this.plugin, { state: this.props.cell.parent, ref: this.props.cell.transform.parent, removeParentGhosts: true });
    };

    toggleVisibility = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        PluginCommands.State.ToggleVisibility(this.plugin, { state: this.props.cell.parent, ref: this.props.cell.transform.parent });
        e.currentTarget.blur();
    }

    highlight = () => {
        const selections = this.selections;
        if (!selections) return;

        this.plugin.managers.interactivity.lociHighlights.clearHighlights();
        for (const d of selections.data) {
            this.plugin.managers.interactivity.lociHighlights.highlight({ loci: d.loci }, false);
        }
        this.plugin.managers.interactivity.lociHighlights.highlight({ loci: this.props.cell.obj?.data.repr.getLoci()! }, false);
    }

    clearHighlight = () => {
        this.plugin.managers.interactivity.lociHighlights.clearHighlights();
    }

    focus = () => {
        const selections = this.selections;
        if (!selections) return;

        const sphere = Loci.getBundleBoundingSphere(toLociBundle(selections.data))
        if (sphere) {
            const { extraRadius, minRadius, durationMs } = MeasurementFocusOptions;
            const radius = Math.max(sphere.radius + extraRadius, minRadius);
            PluginCommands.Camera.Focus(this.plugin, { center: sphere.center, radius, durationMs });
        }
    }

    get label() {
        const selections = this.selections;
        switch (selections?.data.length) {
            case 1: return lociLabel(selections.data[0].loci, { condensed: true })
            case 2: return distanceLabel(toLociBundle(selections.data), { condensed: true, unitLabel: this.plugin.managers.structure.measurement.state.options.distanceUnitLabel })
            case 3: return angleLabel(toLociBundle(selections.data), { condensed: true })
            case 4: return dihedralLabel(toLociBundle(selections.data), { condensed: true })
            default: return ''
        }
    }

    render() {
        const { cell } = this.props;
        const { obj } = cell;
        if (!obj) return null;

        return <div className='msp-btn-row-group' key={obj.id} onMouseEnter={this.highlight} onMouseLeave={this.clearHighlight}>
            <button className='msp-btn msp-btn-block msp-form-control' title='Click to focus. Hover to highlight.' onClick={this.focus}>
                <span dangerouslySetInnerHTML={{ __html: this.label }} />
            </button>
            <IconButton small={true} customClass='msp-form-control' onClick={this.delete} icon='remove' style={{ width: '52px' }} title='Delete' />
            <IconButton small={true} customClass='msp-form-control' onClick={this.toggleVisibility} icon='eye' style={{ width: '52px' }} title={cell.state.isHidden ? 'Show' : 'Hide'} toggleState={!cell.state.isHidden} />
        </div>
    }

}

function toLociBundle(data: FiniteArray<{ loci: Loci }, any>): { loci: FiniteArray<Loci, any> } {
    return { loci: (data.map(d => d.loci) as unknown as FiniteArray<Loci, any>) }
}