import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios'; // Ensure axios is installed
import BPMNEditor from '../components/BPMNEditor';
import type BpmnJS from 'bpmn-js/lib/Modeler';

const API_BASE_URL = '/api/modeler'; // Or your server's base URL

interface DiagramMetadata {
  id: string;
  name: string;
  filename: string;
  createdAt?: string;
}

const initialBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  targetNamespace="http://bpmn.io/schema/bpmn"
                  id="Definitions_initial">
  <bpmn:process id="Process_initial" isExecutable="false">
    <bpmn:startEvent id="StartEvent_initial"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_initial">
    <bpmndi:BPMNPlane id="BPMNPlane_initial" bpmnElement="Process_initial">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_initial" bpmnElement="StartEvent_initial">
        <dc:Bounds height="36.0" width="36.0" x="173.0" y="102.0"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const ModelerPage: React.FC = () => {
  const [bpmnXml, setBpmnXml] = useState<string>(initialBpmnXml);
  const modelerRef = useRef<BpmnJS | null>(null);
  const [savedDiagrams, setSavedDiagrams] = useState<DiagramMetadata[]>([]);
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedDiagrams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<DiagramMetadata[]>(`${API_BASE_URL}/diagrams`);
      setSavedDiagrams(response.data);
    } catch (err) {
      console.error('Error fetching saved diagrams:', err);
      setError('Failed to fetch saved diagrams.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedDiagrams();
  }, [fetchSavedDiagrams]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setBpmnXml(content);
        setCurrentDiagramId(null); // Loaded from file, not server
        setError(null);
      } catch (error) {
        console.error('Error reading BPMN file:', error);
        setError('Error reading BPMN file.');
      }
    };
    reader.onerror = (e) => {
      console.error('FileReader error:', e);
      setError('FileReader error.');
    };
    reader.readAsText(file);
  };

  const handleEditorReady = (modeler: BpmnJS) => {
    modelerRef.current = modeler;
  };

  const handleDownloadLocal = async () => {
    if (!modelerRef.current) {
      alert('Editor not ready.');
      return;
    }
    try {
      const result = await modelerRef.current.saveXML({ format: true });
      const { xml } = result;
      if (xml) {
        const blob = new Blob([xml], { type: 'application/bpmn+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram.bpmn';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setError(null);
      }
    } catch (err) {
      console.error('Could not save BPMN 2.0 diagram locally', err);
      setError('Could not save BPMN diagram locally.');
    }
  };

  const handleSaveToServer = async () => {
    if (!modelerRef.current) {
      alert('Editor not ready.');
      return;
    }
    const name = window.prompt('Enter a name for the diagram:', currentDiagramId ? savedDiagrams.find(d=>d.id === currentDiagramId)?.name || 'Untitled Diagram' : 'Untitled Diagram');
    if (!name) {
      alert('Save cancelled: Diagram name is required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        setError('Failed to generate XML from editor.');
        setIsLoading(false);
        return;
      }
      // Note: For simplicity, we always POST. A PUT for existing currentDiagramId could be an enhancement.
      const response = await axios.post<DiagramMetadata>(`${API_BASE_URL}/diagrams`, { name, xml });
      setCurrentDiagramId(response.data.id);
      alert('Diagram saved successfully!');
      fetchSavedDiagrams(); // Refresh list
    } catch (err) {
      console.error('Error saving diagram to server:', err);
      setError('Failed to save diagram to server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDiagram = async (diagramId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<string>(`${API_BASE_URL}/diagrams/${diagramId}`, {
        responseType: 'text', // Ensure we get XML as text
      });
      setBpmnXml(response.data);
      setCurrentDiagramId(diagramId);
    } catch (err) {
      console.error(`Error loading diagram ${diagramId}:`, err);
      setError(`Failed to load diagram ${diagramId}.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleNewDiagram = () => {
    setBpmnXml(initialBpmnXml);
    setCurrentDiagramId(null);
    setError(null);
    if(modelerRef.current) {
        // Optionally clear selection or reset view in modeler if methods exist
    }
    alert('New diagram created. You can start editing.');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <h1>Modeler Page {currentDiagramId ? `(Editing: ${savedDiagrams.find(d=>d.id === currentDiagramId)?.name || currentDiagramId})` : '(New Diagram)'}</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <div style={{ padding: '10px 0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input type="file" accept=".bpmn, .xml" onChange={handleFileChange} />
        <button onClick={handleSaveToServer} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save to Server'}
        </button>
        <button onClick={handleDownloadLocal} disabled={isLoading}>Download as BPMN</button>
        <button onClick={handleNewDiagram} disabled={isLoading}>New Diagram</button>
      </div>

      <div style={{ display: 'flex', flexGrow: 1, borderTop: '1px solid #eee' }}>
        <div style={{ width: '250px', borderRight: '1px solid #eee', padding: '10px', overflowY: 'auto' }}>
          <h2>Saved Diagrams</h2>
          {isLoading && savedDiagrams.length === 0 && <p>Loading diagrams...</p>}
          {savedDiagrams.length === 0 && !isLoading && <p>No diagrams saved yet.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {savedDiagrams.map((diagram) => (
              <li key={diagram.id} style={{ marginBottom: '10px', borderBottom: '1px solid #f0f0f0', paddingBottom: '5px' }}>
                <div style={{ fontWeight: 'bold' }}>{diagram.name}</div>
                <small>ID: {diagram.id}</small><br/>
                <small>Created: {diagram.createdAt ? new Date(diagram.createdAt).toLocaleString() : 'N/A'}</small><br/>
                <button onClick={() => handleLoadDiagram(diagram.id)} disabled={isLoading || currentDiagramId === diagram.id} style={{marginTop: '5px'}}>
                  {currentDiagramId === diagram.id ? 'Loaded' : 'Load'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flexGrow: 1, position: 'relative' /* For editor container to fill */ }}>
          <BPMNEditor xml={bpmnXml} onEditorReady={handleEditorReady} />
        </div>
      </div>
    </div>
  );
};

export default ModelerPage;
