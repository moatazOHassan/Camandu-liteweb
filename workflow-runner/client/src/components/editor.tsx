import React, { useEffect, useRef } from 'react';
import BpmnJS from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
import * as PropertiesPanelModule from '@bpmn-io/properties-panel';
import zeebeModdleDescriptors from 'zeebe-bpmn-moddle/resources/zeebe.json';

interface BPMNEditorProps {
  xml: string;
  onEditorReady: (modeler: BpmnJS) => void; // New prop
}

// Custom Palette Provider for Element Templates (as a bpmn-js module, using a class)
class ElementTemplatePaletteProvider {
  private templates: any[];
  private create: any;
  private elementFactory: any;
  private bpmnFactory: any;

  constructor(palette: any, create: any, elementFactory: any, _globalConnect: any, bpmnFactory: any, _translate: any, templates: any[]) {
    this.templates = templates;
    this.create = create;
    this.elementFactory = elementFactory;
    this.bpmnFactory = bpmnFactory;
    palette.registerProvider(this);
  }

  getPaletteEntries() {
    const entries: Record<string, any> = {};
    this.templates.forEach((template: any) => {
      if (template.elementType && template.elementType.value === 'bpmn:ServiceTask') {
        entries[template.id] = {
          group: 'activity',
          className: 'bpmn-icon-service-task',
          title: template.name,
          action: {
            dragstart: (event: any) => {
              const shape = this.elementFactory.createShape({
                type: 'bpmn:ServiceTask',
                businessObject: this.bpmnFactory.create('bpmn:ServiceTask', {
                  'zeebe:modelerTemplate': template.id
                })
              });
              this.create.start(event, shape);
            },
            click: (event: any) => {
              const shape = this.elementFactory.createShape({
                type: 'bpmn:ServiceTask',
                businessObject: this.bpmnFactory.create('bpmn:ServiceTask', {
                  'zeebe:modelerTemplate': template.id
                })
              });
              this.create.start(event, shape);
            }
          }
        };
      }
    });
    return entries;
  }
}

function createElementTemplatePaletteModule(templates: any[]) {
  return {
    __init__: ['elementTemplatePaletteProvider'],
    elementTemplatePaletteProvider: [
      'type',
      function(palette: any, create: any, elementFactory: any, globalConnect: any, bpmnFactory: any, translate: any) {
        return new ElementTemplatePaletteProvider(palette, create, elementFactory, globalConnect, bpmnFactory, translate, templates);
      }
    ]
  };
}

const BPMNEditor: React.FC<BPMNEditorProps> = ({ xml, onEditorReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const propertiesPanelRef = useRef<HTMLDivElement>(null);
  const bpmnModelerInstanceRef = useRef<BpmnJS | null>(null);
  const templatesRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || !propertiesPanelRef.current) {
      return;
    }

    // Destroy any previous modeler instance before creating a new one (move here to avoid multiple attachments)
    if (bpmnModelerInstanceRef.current) {
      bpmnModelerInstanceRef.current.destroy();
      bpmnModelerInstanceRef.current = null;
    }

    async function fetchTemplates() {
      const templateFiles = [
        'aws-lambda.json',
        'kafka-connector.json',
        'rest-call-activity.json',
        'sendgrid-email.json',
        'slack-message.json'
      ];
      const templates: any[] = [];
      for (const file of templateFiles) {
        const res = await fetch(`/element-templates/${file}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) {
            templates.push(...json);
          } else {
            templates.push(json);
          }
        }
      }
      return templates;
    }

    async function setupModeler() {
      const templates = await fetchTemplates();
      templatesRef.current = templates;
      const customPaletteModule = createElementTemplatePaletteModule(templates);
      const modeler = new BpmnJS({
        container: containerRef.current || undefined,
        propertiesPanel: {
          parent: propertiesPanelRef.current || undefined
        },
        additionalModules: [
          (PropertiesPanelModule as any).default || PropertiesPanelModule,
          customPaletteModule
        ],
        moddleExtensions: {
          zeebe: zeebeModdleDescriptors
        }
      });
      bpmnModelerInstanceRef.current = modeler;
      onEditorReady(modeler);
      // Always load sample.xml if xml is empty
      if (!xml) {
        try {
          const response = await fetch('/sample.xml');
          if (response.ok) {
            const sampleXml = await response.text();
            await modeler.importXML(sampleXml);
          } else {
            throw new Error('Failed to fetch sample.xml');
          }
        } catch (err) {
          console.error('Error loading sample.xml:', err);
          // fallback to empty diagram
          const emptyXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
            'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
            'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ' +
            'id="empty-diagram" targetNamespace="http://bpmn.io/schema/bpmn">' +
            '<bpmn:process id="empty-process" />' +
            '<bpmndi:BPMNDiagram id="empty-diagram-di">' +
            '<bpmndi:BPMNPlane id="empty-plane-di" bpmnElement="empty-process" />' +
            '</bpmndi:BPMNDiagram>' +
            '</bpmn:definitions>';
          await modeler.importXML(emptyXml);
        }
      } else {
        await importDiagram(modeler);
      }
    }

    async function importDiagram(modeler: BpmnJS) {
      if (!modeler) return;
      try {
        if (!xml) {
          const emptyXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
            'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
            'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ' +
            'id="empty-diagram" targetNamespace="http://bpmn.io/schema/bpmn">' +
            '<bpmn:process id="empty-process" />' +
            '<bpmndi:BPMNDiagram id="empty-diagram-di">' +
            '<bpmndi:BPMNPlane id="empty-plane-di" bpmnElement="empty-process" />' +
            '</bpmndi:BPMNDiagram>' +
            '</bpmn:definitions>';
          await modeler.importXML(emptyXml);
        } else {
          const { warnings } = await modeler.importXML(xml);
          if (warnings.length) {
            console.warn('BPMN import warnings:', warnings);
          }
        }
        const canvas = modeler.get('canvas') as any;
        canvas?.zoom('fit-viewport');
      } catch (err) {
        console.error('Error importing BPMN XML:', err);
        throw err;
      }
    }

    setupModeler();

    return () => {
      if (bpmnModelerInstanceRef.current) {
        bpmnModelerInstanceRef.current.destroy();
        bpmnModelerInstanceRef.current = null;
      }
    };
  }, [xml, onEditorReady]); // Added onEditorReady to dependencies, though it should be stable

  useEffect(() => {
    if (!bpmnModelerInstanceRef.current) return;

    const modeler = bpmnModelerInstanceRef.current;
    const eventBus = modeler.get('eventBus') as any; // Explicitly type as 'any' for now

    const handleElementClick = (event: any) => {
      const element = event.element;
      if (element.type === 'bpmn:Task') {
        console.log('Task clicked:', element);
        // Logic to update the properties panel can be added here
      }
    };

    eventBus.on('element.click', handleElementClick);

    return () => {
      eventBus.off('element.click', handleElementClick);
    };
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', minWidth: '1000px' }}>
      ممممممم<div
        ref={containerRef}
        style={{ height: '100%', flex: 1, minWidth: '700px', border: '1px solid #ccc', background: '#fff' }}
      />
      <div
        ref={propertiesPanelRef}
        style={{
          width: '300px',
          height: '100%',
          borderLeft: '1px solid #ccc',
          overflow: 'auto'
        }}
      />
    </div>
  );
};

export default BPMNEditor;
