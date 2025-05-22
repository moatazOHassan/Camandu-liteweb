import React, { useEffect, useRef } from 'react';
import BpmnJS from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
// import '@bpmn-io/zeebe-properties-panel/dist/assets/zeebe.css'; // REMOVED: not available
import * as PropertiesPanelModule from '@bpmn-io/properties-panel';
// import ZeebePropertiesProviderModule from '@bpmn-io/zeebe-properties-panel'; // REMOVED: not available
import zeebeModdleDescriptors from 'zeebe-bpmn-moddle/resources/zeebe.json';

// Helper functions and constants
const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1"/>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"/>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

async function loadTemplates() {
  const files = [
    'aws-lambda.json',
    'kafka-connector.json',
    'rest-call-activity.json',
    'sendgrid-email.json',
    'slack-message.json',
  ];

  const templates = [];
  for (const file of files) {
    try {
      const res = await fetch(`/element-templates/${file}`);
      if (res.ok) {
        const json = await res.json();
        Array.isArray(json) ? templates.push(...json) : templates.push(json);
      }
    } catch {
      // Ignore errors for individual files
    }
  }
  return templates;
}

function createElementTemplatePalette(templates: any[]) {
  class ElementTemplatePaletteProvider {
    static $inject = ['palette', 'create', 'elementFactory', 'globalConnect', 'bpmnFactory', 'translate'];
    
    private templates: any[];
    private create: any;
    private elementFactory: any;
    private bpmnFactory: any;

    constructor(
      palette: any,
      create: any,
      elementFactory: any,
      _globalConnect: any,
      bpmnFactory: any,
      _translate: any
    ) {
      this.templates = templates;
      this.create = create;
      this.elementFactory = elementFactory;
      this.bpmnFactory = bpmnFactory;
      palette.registerProvider(this);
    }

    getPaletteEntries() {
      const entries: Record<string, any> = {};

      this.templates.forEach((tpl) => {
        if (tpl.elementType?.value !== 'bpmn:ServiceTask') return;

        entries[tpl.id] = {
          group: 'activity',
          className: 'bpmn-icon-service-task',
          title: tpl.name,
          action: {
            dragstart: (event: any) => this._createTask(event, tpl.id),
            click: (event: any) => this._createTask(event, tpl.id),
          },
        };
      });

      return entries;
    }

    private _createTask(event: any, templateId: string) {
      const shape = this.elementFactory.createShape({
        type: 'bpmn:ServiceTask',
        businessObject: this.bpmnFactory.create('bpmn:ServiceTask', {
          'zeebe:modelerTemplate': templateId,
        }),
      });

      this.create.start(event, shape);
    }
  }

  return {
    __init__: ['elementTemplatePaletteProvider'],
    elementTemplatePaletteProvider: ['type', ElementTemplatePaletteProvider]
  };
}

interface Canvas {
  zoom(type: 'fit-viewport' | number): void;
}

const BPMNEditor: React.FC<{ xml?: string; onEditorReady?: (modeler: BpmnJS) => void }> = ({ xml, onEditorReady }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const propsPanelRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !propsPanelRef.current) return;

    let canceled = false;

    (async () => {
      const templates = await loadTemplates();
      if (canceled) return;

      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }

      const templatePaletteModule = createElementTemplatePalette(templates);

      try {
        const modeler = new BpmnJS({
          container: canvasRef.current as HTMLElement,
          propertiesPanel: {
            parent: propsPanelRef.current as HTMLElement
          },
          additionalModules: [
            PropertiesPanelModule,
            templatePaletteModule
          ],
          moddleExtensions: {
            zeebe: zeebeModdleDescriptors
          }
        });

        modelerRef.current = modeler;
        onEditorReady?.(modeler);

        const { warnings } = await modeler.importXML(xml || EMPTY_DIAGRAM);
        if (warnings.length) {
          console.warn('Import warnings:', warnings);
        }

        const canvas = modeler.get('canvas') as Canvas;
        canvas.zoom('fit-viewport');
      } catch (err) {
        console.error('Failed to create/import BPMN diagram:', err);
      }
    })();

    return () => {
      canceled = true;
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, [xml, onEditorReady]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div ref={canvasRef} style={{ flex: 1, border: '1px solid #ccc' }} />
      <div ref={propsPanelRef} style={{ width: 300, borderLeft: '1px solid #ccc' }} />
    </div>
  );
};

export default BPMNEditor;
