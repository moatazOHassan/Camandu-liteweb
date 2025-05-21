import React, { useEffect, useRef } from 'react';
import BpmnJS from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

interface BPMNEditorProps {
  xml: string;
  onEditorReady: (modeler: BpmnJS) => void; // New prop
}

const BPMNEditor: React.FC<BPMNEditorProps> = ({ xml, onEditorReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmnModelerInstanceRef = useRef<BpmnJS | null>(null); // Renamed to avoid confusion with prop

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) {
      return;
    }

    if (!bpmnModelerInstanceRef.current) {
      const modeler = new BpmnJS({
        container: containerRef.current,
        keyboard: {
          bindTo: window,
        },
      });
      bpmnModelerInstanceRef.current = modeler;
      onEditorReady(modeler); // Call the callback
    }

    const importDiagram = async () => {
      if (bpmnModelerInstanceRef.current && xml) {
        try {
          await bpmnModelerInstanceRef.current.importXML(xml);
          const canvas: any = bpmnModelerInstanceRef.current.get('canvas');
          if (canvas) {
            canvas.zoom('fit-viewport');
          }
        } catch (err) {
          console.error('Error importing BPMN XML:', err);
        }
      } else if (bpmnModelerInstanceRef.current) {
        console.log("XML is empty, editor will be blank or show previous diagram until new XML is loaded.");
        // Attempt to clear the diagram or load a new empty one if xml is empty
        try {
            await bpmnModelerInstanceRef.current.importXML('<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="emptyDefinition"></bpmn:definitions>');
        } catch (clearErr) {
            console.error('Error clearing diagram:', clearErr);
        }
      }
    };

    importDiagram();

  }, [xml, onEditorReady]); // Added onEditorReady to dependencies, though it should be stable

  useEffect(() => {
    return () => {
      if (bpmnModelerInstanceRef.current) {
        bpmnModelerInstanceRef.current.destroy();
        bpmnModelerInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: '500px', border: '1px solid #ccc', background: '#fff' }}
    />
  );
};

export default BPMNEditor;
