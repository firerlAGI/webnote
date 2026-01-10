import { Button } from '../../components/ui';

// FoldersList component for managing folders
const FoldersList = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">我的文件夹</h1>
        </div>
        <Button variant="primary" className="w-full md:w-auto">创建文件夹</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Folder cards will be rendered here */}
      </div>
    </div>
  );
};

export default FoldersList;
